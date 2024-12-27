---
title: "{{ replace .Name "-" " " | title }}"
description: "{{ .Name }}"
keywords: "{{replace .Name "-" ","}}"

date: {{ .Date }}
lastmod: {{ .Date }}

math: true
mermaid: true

categories:
  - journal
tags:
  -
  -
---
{{ replace .Name "-" " " | title }}
<!--more-->
