#!/usr/bin/env python3
"""Check published blog HTML and assets without a browser or third-party packages.

Run after Hugo: python3 scripts/check-built-site.py [public-directory]
The source post filenames define this site's URLs and Kindred chapter order.
"""

import argparse
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urljoin, urlsplit


REPO = Path(__file__).resolve().parents[1]
FAVICON_BUDGET = 32 * 1024  # Multi-size ICO, comfortably below the old full-size artwork.
SUMMARY_LIMIT = 110


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.h1_count = 0
        self.ids = []
        self.links = []
        self.images = []
        self.sources = []
        self.giscus = []
        self.stylesheets = []
        self.scripts = []
        self.body_text = []
        self._in_body = False
        self._skip_text = False
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == "body":
            self._in_body = True
        if tag in ("script", "style"):
            self._skip_text = True
        if tag == "h1":
            self.h1_count += 1
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a":
            self.links.append(attrs)
        if tag == "img":
            self.images.append(attrs)
        if tag == "source":
            self.sources.append(attrs)
        if tag == "link" and "stylesheet" in attrs.get("rel", "").split():
            self.stylesheets.append(attrs)
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs)
        if tag == "script" and attrs.get("src") == "https://giscus.app/client.js":
            self.giscus.append(attrs)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "body":
            self._in_body = False
        if tag in ("script", "style"):
            self._skip_text = False

    def handle_data(self, data):
        if self._in_body and not self._skip_text:
            self.body_text.append(data)


def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("Expected YAML front matter in " + str(path))
    return text.split("---", 2)[1]


def published_sources():
    """Use the same draft/future defaults as the production Hugo invocation."""
    sources = {}
    today = datetime.now(timezone.utc).date()
    for path in (REPO / "content/post").rglob("*.md"):
        if path.name == "_index.md":
            continue
        metadata = frontmatter(path)
        if re.search(r"(?im)^draft:\s*true\s*$", metadata):
            continue
        date = re.search(r"(?im)^publishdate:\s*['\"]?(\d{4}-\d{2}-\d{2})", metadata)
        if not date:
            date = re.search(r"(?im)^date:\s*['\"]?(\d{4}-\d{2}-\d{2})", metadata)
        if date and datetime.strptime(date[1], "%Y-%m-%d").date() > today:
            continue
        sources[path.stem.lower()] = path
    return sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", default="public", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    config = (REPO / "hugo.toml").read_text(encoding="utf-8")
    base_match = re.search(r"(?m)^baseURL\s*=\s*['\"]([^'\"]+)", config)
    if not base_match:
        parser.error("Cannot determine baseURL from hugo.toml")
    base_url = base_match[1].rstrip("/") + "/"
    site = urlsplit(base_url)
    base_path = site.path

    def local_path(url, page_path=None):
        """Map /biosite/... to output/...; leave external/data URLs unchecked."""
        relative_page = page_path.relative_to(output).as_posix() if page_path else ""
        target = urlsplit(urljoin(urljoin(base_url, relative_page), url))
        if target.scheme not in ("http", "https") or target.netloc != site.netloc:
            return None
        path = unquote(target.path)
        if not path.startswith(base_path):
            check(False, "Local resource escaped the site's baseURL path: " + url)
            return None
        result = output / path[len(base_path):]
        if target.path.endswith("/"):
            result /= "index.html"
        return result

    index_path = output / "search-index.json"
    if not index_path.is_file():
        parser.error("Missing search-index.json; run Hugo first: " + str(index_path))
    entries = json.loads(index_path.read_text(encoding="utf-8"))
    check(isinstance(entries, list) and bool(entries), "Search index must be a nonempty array")
    if not isinstance(entries, list):
        entries = []
    urls = [entry.get("url", "") for entry in entries]
    check(len(urls) == len(set(urls)), "Search index contains duplicate URLs")
    sources = published_sources()
    indexed_by_slug = {
        unquote(urlsplit(url).path.rstrip("/").split("/")[-1]).lower(): url
        for url in urls
    }
    check(set(indexed_by_slug) == set(sources),
          "Search index differs from published source posts: missing="
          + str(sorted(set(sources) - set(indexed_by_slug))) + "; unexpected="
          + str(sorted(set(indexed_by_slug) - set(sources))))

    pages = {}
    for entry in entries:
        url = entry.get("url", "")
        summary = entry.get("summary", "")
        check(isinstance(summary, str) and len(summary) <= SUMMARY_LIMIT,
              "Search summary exceeds %d characters: %s" % (SUMMARY_LIMIT, url))
        path = local_path(url)
        if path is None or not path.is_file():
            check(False, "Indexed article does not exist locally: " + url)
            continue
        page = Page(path)
        pages[url] = page
        check(page.h1_count == 1, "Expected one H1 in " + url)
        duplicates = [key for key, count in Counter(page.ids).items() if count > 1]
        check(not duplicates, "Duplicate IDs in %s: %s" % (url, duplicates))

    image_count = 0
    responsive_count = 0
    for path in output.rglob("*.html"):
        page = Page(path)
        label = path.relative_to(output).as_posix()
        # Every real page must request the exact CSS/JS content it was built with.
        # This catches mixed-version deployments for visitors with warm caches.
        if page.h1_count:
            references = [item.get("href", "") for item in page.stylesheets]
            references += [item.get("src", "") for item in page.scripts]
            for directory, name in (("site-css", "custom.css"),
                                    ("site-js", "local-search.js"),
                                    ("site-js", "navigation.js"),
                                    ("site-js", "kindred-toc.js"),
                                    ("site-js", "theme-toggle-override.js"),
                                    ("js", "main.js"),
                                    ("js", "pjax_main.js")):
                stem, extension = name.rsplit(".", 1)
                pattern = r"/%s/%s\.([0-9a-f]{64})\.%s$" % (directory, re.escape(stem), extension)
                matches = [(ref, re.search(pattern, urlsplit(ref).path)) for ref in references]
                matches = [(ref, match) for ref, match in matches if match]
                check(len(matches) == 1, "Missing fingerprinted %s in %s" % (name, label))
                for ref, match in matches:
                    target = local_path(ref, path)
                    check(target is not None and target.is_file(), "Missing versioned asset in " + label)
                    if target is not None and target.is_file():
                        check(hashlib.sha256(target.read_bytes()).hexdigest() == match[1],
                              "Asset fingerprint does not match its content in " + label)
        for image in page.images + page.sources:
            for key in ("src", "data-src"):
                if image.get(key):
                    target = local_path(image[key], path)
                    if target is not None:
                        image_count += 1
                        check(target.is_file(), "Missing image in %s: %s" % (label, image[key]))
            if image.get("srcset"):
                responsive_count += 1
                if image in page.images:
                    check(bool(image.get("sizes")), "Responsive image lacks sizes in " + label)
                    check(all(str(image.get(k, "")).isdigit() and int(image[k]) > 0
                              for k in ("width", "height")),
                          "Responsive image lacks positive dimensions in " + label)
                for candidate in image["srcset"].split(","):
                    parts = candidate.strip().split()
                    check(len(parts) == 2 and bool(re.fullmatch(r"\d+(?:\.\d+)?[wx]", parts[-1])),
                          "Invalid srcset candidate in %s: %s" % (label, candidate))
                    if parts:
                        target = local_path(parts[0], path)
                        if target is not None:
                            check(target.is_file(), "Missing srcset resource in %s: %s" % (label, parts[0]))
        for script in page.giscus:
            theme = script.get("data-theme", "")
            check(bool(theme) and not re.search(r"map\[|\[object|[{}\s]", theme),
                  "Invalid Giscus data-theme in %s: %r" % (label, theme))
    check(responsive_count > 0, "No responsive images were generated")

    not_found_path = output / "404.html"
    check(not_found_path.is_file(), "Missing 404 page")
    if not_found_path.is_file():
        not_found = Page(not_found_path)
        check(not_found.h1_count == 1, "404 page must contain exactly one H1")
        check("404" in " ".join(not_found.body_text), "404 page has no visible 404 message")
        destinations = {urljoin(base_url, link.get("href", "")).rstrip("/")
                        for link in not_found.links}
        for destination in (base_url, urljoin(base_url, "archives/")):
            check(destination.rstrip("/") in destinations,
                  "404 page has no recovery link to " + destination)
        css = {local_path(link["href"], not_found_path) for link in not_found.stylesheets
               if link.get("href")}
        scripts = {local_path(script["src"], not_found_path) for script in not_found.scripts}
        for prefix, references in (("custom.", css), ("navigation.", scripts)):
            check(any(asset and asset.is_file() and asset.name.startswith(prefix) for asset in references),
                  "404 page is missing the versioned local asset " + prefix)

    archive_path = output / "archives/index.html"
    check(archive_path.is_file(), "Missing archive index")
    if archive_path.is_file():
        archive = Page(archive_path)
        archive_posts = [link.get("href", "") for link in archive.links
                         if "/post/" in urlsplit(link.get("href", "")).path]
        check(Counter(archive_posts) == Counter(urls),
              "Archive must link to every indexed post exactly once")
        check("page-nav" not in archive.ids, "Archive unexpectedly contains pagination")
        check(not (output / "archives/page/2/index.html").exists(),
              "Archive unexpectedly generated a second page")

    kindred_slugs = [slug for slug in sources if slug.startswith("kindred_")]
    numbered = sorted((slug for slug in kindred_slugs if re.fullmatch(r"kindred_\d+", slug)),
                      key=lambda slug: int(slug.rsplit("_", 1)[1]))
    check([int(slug.rsplit("_", 1)[1]) for slug in numbered] == list(range(1, len(numbered) + 1)),
          "Kindred numbered chapters must be contiguous, beginning at chapter 1")
    sequence = ["kindred_prologue"] + numbered + ["kindred_epilogue"]
    check(set(sequence) == set(kindred_slugs), "Kindred chapter sources do not match the expected series structure")
    for position, slug in enumerate(sequence):
        url = indexed_by_slug.get(slug)
        page = pages.get(url)
        if page is None:
            check(False, "Missing Kindred chapter: " + slug)
            continue
        expected = {}
        if position:
            expected["prev"] = indexed_by_slug.get(sequence[position - 1])
        if position + 1 < len(sequence):
            expected["next"] = indexed_by_slug.get(sequence[position + 1])
        neighbors = [link for link in page.links
                     if "article-neighbor" in link.get("class", "").split()]
        actual = {link.get("rel"): link.get("href") for link in neighbors}
        check(actual == expected and len(neighbors) == len(expected),
              "Wrong chapter neighbors for %s: expected %s, got %s" % (slug, expected, actual))
        toc = [link for link in page.links if "kindred-toc-link" in link.get("class", "").split()]
        check([link.get("href") for link in toc] == [indexed_by_slug.get(s) for s in sequence],
              "Wrong Kindred table-of-contents order in " + slug)
        check([link.get("href") for link in toc if link.get("aria-current") == "page"] == [url],
              "Wrong current chapter in " + slug)

    favicon = output / "favicon.ico"
    check(favicon.is_file(), "Missing favicon.ico")
    if favicon.is_file():
        check(0 < favicon.stat().st_size <= FAVICON_BUDGET,
              "favicon.ico exceeds the %d KiB budget" % (FAVICON_BUDGET // 1024))

    if errors:
        for error in errors:
            print("FAIL:", error, file=sys.stderr)
        print("%d built-site check(s) failed." % len(errors), file=sys.stderr)
        return 1
    print("Built-site checks passed: %d articles, %d Kindred chapters, %d local image references, "
          "%d responsive images; favicon %d bytes." %
          (len(entries), len(sequence), image_count, responsive_count, favicon.stat().st_size))
    return 0


if __name__ == "__main__":
    sys.exit(main())
