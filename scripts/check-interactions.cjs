"use strict";

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Execute the production scripts against a minimal in-memory event/DOM fixture.
// These checks cover asynchronous races, interaction state and navigation records.
// CSS layout, browser focus behavior and real bfcache restoration need browser QA.
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
  removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(fn => fn !== handler)); }
  off(type) { this.listeners.delete(type); }
  dispatchEvent(event) {
    event.target ||= this;
    event.preventDefault ||= function () { this.defaultPrevented = true; };
    for (const handler of [...(this.listeners.get(event.type) || [])]) handler.call(this, event);
    if (event.bubbles && this.parentElement) this.parentElement.dispatchEvent(event);
    else if (event.bubbles && this.ownerDocument && this !== this.ownerDocument) this.ownerDocument.dispatchEvent(event);
    return !event.defaultPrevented;
  }
}
class Element extends Events {
  constructor(tag, doc) { super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.attrs = new Map(); this.children = []; this.dataset = {}; this.style = {}; this.textContent = ''; this.scrollTop = 0; this.clientHeight = 400; this.offsetHeight = 48; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  get id() { return this.getAttribute('id') || ''; } set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; } set className(v) { this.setAttribute('class', v); }
  get href() { return this.getAttribute('href') || ''; } set href(v) { this.setAttribute('href', v); }
  get inert() { return this.hasAttribute('inert'); } set inert(v) { if(v)this.setAttribute('inert','');else this.removeAttribute('inert'); }
  get isConnected() { return this === this.ownerDocument.documentElement || Boolean(this.parentElement?.isConnected); }
  get classList() {
    const el = this;
    return { contains: c => el.className.split(/\s+/).includes(c), add: c => { if(!el.className.split(/\s+/).includes(c))el.className=(el.className+' '+c).trim(); }, remove: c => {el.className=el.className.split(/\s+/).filter(x=>x!==c).join(' ');}, toggle(c, value) {const next=value ?? !this.contains(c);next?this.add(c):this.remove(c);return next;} };
  }
  matches(selector) {
    return selector.split(',').some(raw => {
      let s = raw.trim();
      if (s.includes(':not([disabled])')) { if(this.hasAttribute('disabled'))return false;s=s.replace(':not([disabled])',''); }
      const tag = s.match(/^[a-z]+/i)?.[0]; if(tag && this.tagName !== tag.toUpperCase())return false;
      const id = s.match(/#([\w-]+)/)?.[1]; if(id && this.id!==id)return false;
      const classes=[...s.matchAll(/\.([\w-]+)/g)].map(m=>m[1]); if(classes.some(c=>!this.classList.contains(c)))return false;
      const attrs=[...s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
      return attrs.every(([,key,value]) => this.hasAttribute(key) && (value===undefined || this.getAttribute(key)===value));
    });
  }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  append(...items) { for(const item of items){item.remove();this.children.push(item);item.parentElement=this;} }
  prepend(item) { item.remove();this.children.unshift(item);item.parentElement=this; }
  remove() { if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null; }
  replaceChildren(...items) { for(const c of [...this.children])c.remove();this.append(...items); }
  replaceWith(item) { const parent=this.parentElement;const index=parent.children.indexOf(this);this.remove();parent.children.splice(index,0,item);item.parentElement=parent; }
  querySelectorAll(selector) { return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { if(!this.closest('[inert]'))this.ownerDocument.activeElement=this; }
  getClientRects() { return this.closest('[inert]')?[]:[{}]; }
  getBoundingClientRect() { return {top:20}; }
  scrollTo({top}) { this.scrollTop=top; }
}
class Document extends Events {
  constructor() { super();this.documentElement=new Element('html',this);this.body=new Element('body',this);this.documentElement.append(this.body);this.activeElement=this.body;this.readyState='complete'; }
  createElement(tag) { return new Element(tag,this); }
  getElementById(id) { return this.querySelector('#'+id); }
  querySelector(selector) { return this.documentElement.querySelector(selector); }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
}
function storage() { const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; }
const document = new Document();
const window = new Events();
const location = new URL('https://example.test/biosite/page/2/');
Object.assign(window,{document,location,scrollY:720,siteConfig:{base:'https://example.test/biosite/'},setTimeout,clearTimeout,matchMedia:()=>({matches:true,addEventListener(){}}),scrollTo({top}){window.scrollY=top;}});
const localStorage=storage(),sessionStorage=storage();
const animationFrames=[];
const context=vm.createContext({document,window,location,localStorage,sessionStorage,URL,console,Promise,CustomEvent:class {constructor(type,options={}){this.type=type;Object.assign(this,options);}},MutationObserver:class {constructor(callback){this.callback=callback;}observe(){}},requestAnimationFrame:cb=>animationFrames.push(cb),setTimeout,clearTimeout});
const element=(tag,id,cls,parent=document.body)=>{const el=document.createElement(tag);if(id)el.id=id;if(cls)el.className=cls;parent.append(el);return el;};
const subnav=element('nav','sub-nav');
const oldTheme=element('a',null,'nav-icon dark-mode-btn',subnav);
const comments=element('div',null,'giscus-comment');
const commentFrame=element('iframe',null,'giscus-frame',comments);
const commentMessages=[];
commentFrame.contentWindow={postMessage:(message,origin)=>commentMessages.push({message,origin})};
const toggle=element('button','main-nav-toggle');
const mask=element('div','mask');
const menu=element('nav','mobile-nav');
const menuClose=element('button',null,'mobile-nav-close',menu);
const menuLink=element('a',null,null,menu);menuLink.href='/biosite/archives/';
let oldToggleCalls=0;toggle.addEventListener('click',()=>oldToggleCalls++);
const modal=element('div','local-search');modal.dataset.index='/biosite/search-index.json';modal.dataset.maxResults='12';
const backdrop=element('button',null,'local-search-backdrop',modal);backdrop.setAttribute('data-search-close','');backdrop.setAttribute('tabindex','-1');
const close=element('button',null,'local-search-close',modal);close.setAttribute('data-search-close','');
const input=element('input','local-search-input',null,modal);input.value='';
const status=element('p','local-search-status',null,modal);
const results=element('div','local-search-results',null,modal);
const root=element('div',null,'kindred-toc-widget');root.setAttribute('data-kindred-toc','');
const trigger=element('button',null,'kindred-toc-trigger',root);
const panel=element('aside',null,'kindred-toc-panel',root);
const tocClose=element('button',null,'kindred-toc-close',panel);tocClose.setAttribute('data-kindred-toc-close','');
const chapterList=element('nav',null,'kindred-toc-list',panel);
const chapter=element('a',null,'kindred-toc-link',chapterList);chapter.href='/biosite/post/kindred_1/';chapter.setAttribute('aria-current','page');
const listing=element('div',null,'blog-list');
const articleLink=element('a',null,null,listing);articleLink.href='https://example.test/biosite/post/research/';
const back=element('a',null,'post-back-link');back.setAttribute('data-return-to-list','');back.href='/biosite/archives/';
let resolveIndex;let fetchCount=0;
context.fetch=()=>{fetchCount++;return new Promise(resolve=>{resolveIndex=()=>resolve({ok:true,json:async()=>[
  ...Array.from({length:14},(_,i)=>({title:'Kindred '+i,url:'/biosite/post/kindred_'+i+'/',date:'2026-07-20',content:'novel',summary:'长摘要 '.repeat(200)})),
  {title:'Research',url:'/biosite/post/research/',date:'2026-09-15',content:'science',summary:'scientific note'},
]})});};
const run=file=>vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'static', 'js', file), 'utf8'),context,{filename:file});
run('local-search.js');run('navigation.js');run('kindred-toc.js');run('theme-toggle-override.js');
const click=el=>el.dispatchEvent({type:'click',button:0,bubbles:true});
const key=(key,extra={})=>document.dispatchEvent({type:'keydown',key,...extra});
const type=value=>{input.value=value;input.dispatchEvent({type:'input'});};
const tick=async()=>{
  // Drain promise jobs and requested frames without depending on wall-clock timing.
  await new Promise(setImmediate);
  while(animationFrames.length) {
    animationFrames.splice(0).forEach(callback=>callback());
    await new Promise(setImmediate);
  }
};
(async()=>{
  click(document.getElementById('local-search-open'));
  await tick();assert.equal(document.activeElement,input, 'search receives focus after opening');
  type('kindred');type('research');resolveIndex();await tick();
  assert.equal(fetchCount,1);assert.equal(results.querySelectorAll('a').length,1);assert.equal(results.querySelector('strong').textContent,'Research');
  type('kindred');await tick();assert.equal(results.querySelectorAll('a').length,12);assert.ok(results.querySelector('.local-search-more'));
  assert.ok(Array.from(results.querySelector('.local-search-result-summary').textContent).length<=161);
  click(results.querySelector('.local-search-more'));assert.equal(results.querySelectorAll('a').length,14);assert.equal(results.querySelector('.local-search-more'),null);
  const last=results.querySelectorAll('a').at(-1);last.focus();key('Tab');assert.equal(document.activeElement,close);
  close.focus();key('Tab',{shiftKey:true});assert.equal(document.activeElement,last);
  results.querySelector('a').dispatchEvent({type:'click',button:0,metaKey:true,bubbles:true});
  assert.equal(modal.inert,false, 'opening a result in a new tab keeps search available');
  click(results.querySelector('a'));assert.equal(modal.inert,true);assert.equal(document.body.classList.contains('search-open'),false);
  click(trigger);await tick();assert.equal(document.activeElement,tocClose);
  assert.equal(panel.inert,false);key('k',{metaKey:true});assert.equal(panel.inert,true);assert.equal(modal.inert,false);
  await tick();assert.equal(document.activeElement,input);
  key('Escape');assert.equal(modal.inert,true);assert.equal(document.activeElement,document.getElementById('local-search-open'));
  click(toggle);await tick();assert.equal(document.activeElement,menuClose);assert.equal(oldToggleCalls,0);assert.equal(menu.getAttribute('aria-hidden'),'false');assert.equal(toggle.getAttribute('aria-expanded'),'true');
  click(mask);assert.equal(menu.inert,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  click(toggle);key('k',{ctrlKey:true});assert.equal(menu.inert,true);assert.equal(modal.inert,false);key('Escape');
  await tick();assert.equal(document.activeElement,document.getElementById('local-search-open'), 'queued focus must not enter a closed overlay');
  click(articleLink);assert.equal(JSON.parse(sessionStorage.getItem('blog-return:/biosite/:article:/biosite/post/research/')).from,'/biosite/page/2/');
  listing.remove();
  location.pathname='/biosite/post/research/';
  window.dispatchEvent({type:'pageshow',persisted:false});
  assert.equal(back.href,'/biosite/page/2/');
  // A -> B -> browser Back to A must keep A's original list context.
  const nextArticle=element('a');
  nextArticle.href='/biosite/post/another/';
  click(nextArticle);
  location.pathname='/biosite/post/another/';
  window.dispatchEvent({type:'pageshow',persisted:false});
  assert.equal(back.href,'/biosite/page/2/');
  location.pathname='/biosite/post/research/';
  window.dispatchEvent({type:'pageshow',persisted:true});
  assert.equal(back.href,'/biosite/page/2/');
  click(back);location.pathname='/biosite/page/2/';window.scrollY=0;window.dispatchEvent({type:'pageshow',persisted:false});await tick();assert.equal(window.scrollY,720);
  window.scrollY=555;window.dispatchEvent({type:'pageshow',persisted:true});await tick();
  assert.equal(window.scrollY,555, 'normal browser Back keeps its native scroll restoration');
  const snapshot=sessionStorage.getItem('blog-return:/biosite/:article:/biosite/post/research/');const external=element('a');external.href='https://outside.test/post/';click(external);assert.equal(sessionStorage.getItem('blog-return:/biosite/:article:/biosite/post/research/'),snapshot);
  const theme=document.querySelector('.dark-mode-btn');assert.equal(theme.tagName,'BUTTON');click(theme);assert.equal(localStorage.getItem('dark_mode'),'true');assert.equal(document.documentElement.getAttribute('data-theme'),'dark');
  assert.equal(commentMessages.at(-1).origin,'https://giscus.app');
  assert.equal(commentMessages.at(-1).message.giscus.setConfig.theme,'dark');
  document.documentElement.removeAttribute('data-theme');window.dispatchEvent({type:'pageshow',persisted:true});assert.equal(document.documentElement.getAttribute('data-theme'),'dark');
  console.log('PASS: delayed-search race, single fetch, load-more, excerpt bound, search focus loop, result close, modal exclusivity, deferred focus and focus restore, legacy menu listener removal, menu state sync, article-chain Back and list pagination/scroll restore, external-link isolation, native theme button, stored-theme restoration, Giscus theme synchronization.');
})().catch(error=>{console.error(error);process.exitCode=1;});
