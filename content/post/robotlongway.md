---
title: 'Robotics has a long way'
cover: https://github.com/Selen-Suyue/Wallpaper/raw/main/qingyin1.jpg
categor: journal
tag: Robotics
date: 2025-11-15
lastmod: 2025-11-15
---

Robotics has a long way是我现在的感叹。
最近我做world model for action generation不出意外的又失败了。毋宁说，基于vlm backbone做world model又失败了。

这实在是可以预见但是又让我失落的事情。我们可以想见。正如我前面所说，下游的低知识的模态想传递知识给上游的高知识的模态是很困难的事情。
也就是生成（image gen）帮助理解（language gen）是很难的事情。一旦你试图这样做，就很容易把模型训崩。

我是一个计算机民科，关于这两个模态的知识高低的争论暂且搁置。连续和离散是没有什么争议的。那么可以说，理解帮助生成是一个熵增过程，所以很容易。
而生成帮助理解是一个熵减的过程，所以要做不少功，所以很难。

至于action和vision，如果抛开知识浓度的高低不谈，谁的熵比较大还真不好说，但是肯定都高于language... 

所以Robotics has a long way...

#ps:
我需要补充的是，即便world model做出来了，在for action generation的时候考虑的高动态场景也不是world model claim的dynamics prediction
可以负担的。比如考虑轮盘抓物体这种任务，dynamics预测的未来动态往往是很难和时间精确对齐的。即便对齐了，采集数据时候的时间是没有考虑机器人部署的
时候涉及的传输，推理，以及可能的试错的时间都，这件事情模仿学习根本解决不了，只可能是强化学习解决。

因此robotics still has a long way.