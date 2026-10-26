# 手机机型与状态栏参考

单张作图与批量作图共用同一机型目录，共 62 个具体型号，其中安卓及鸿蒙机型 51 个。先选择品牌，再选择型号；选中后立即生成对应状态栏，不需要再点击应用。

## 图片适配

- 模板制作不配置状态栏；进入作图后保持用户选择的画布尺寸。切换型号只更新状态栏，不会强行改成该型号的参考分辨率。
- 根据画布宽高缩放状态栏，文字按可用空间缩小，图标组避让中心开孔，并限制垂直偏移，避免越出图片边界。
- 自动采样图片顶栏的主色和对比度。对接近手机截图比例的图片估算原顶栏高度，再覆盖旧图标；裁剪或修改过的图片可手动调整覆盖高度。
- 编辑器默认也保持画布大小；只有开启“同时适配机型画布尺寸”时，切换型号才调整画布。
- 保存、批量生成和预览仍只输出屏幕内容，不包含手机外壳或硬件开孔。

## 系统样式

按品牌系统提供时钟字重、信号形状、Wi-Fi 样式、横向或竖向电池、圆角、图标顺序与间距。Pixel 使用三角形信号和竖向电池，三星 One UI 6 使用竖向电池，S25 系列按 One UI 7 使用横向胶囊电池；国产系统分别提供横向电池及对应比例、间距和默认电量显示方式。

这些是可编辑矢量参考样式，不是从真机系统中导出的资源。系统版本、主题、地区版本和显示缩放会影响实际样式；一加按国行 ColorOS、vivo / iQOO 按国行 OriginOS 处理。以下为参考原生像素尺寸，系统分辨率设置也可能改变截图大小。未经过逐台真机截图对照，不宣称所有版本像素级一致。

批量可勾选指定型号独立随机或均衡分配，并按最小共同容量校验 APP 数量。详见[批量随机指南](BATCH_DRAWING.zh-CN.md)。

## APP 通知设计图标

各机型均可搜索并选用快手、抖音、微信、QQ、小红书、淘宝、钉钉等 28 种内置通知图标，或上传自定义 PNG / JPEG / WebP。最多 8 个，支持顺序、显隐、大小与间距；空间不足时调整时间与通知区域，不覆盖中间开孔或右侧系统图标。自定义素材随模板和备份携带，换机型、调整画布和批量生成时保留。

这是额外的可编辑设计图层，不表示每个机型的原生系统都会显示这些 APP 通知。内置图标单色跟随状态栏配色，上传图标保留原色。

## 具体型号

| 品牌 | 型号 | 参考尺寸 | 状态栏系统 |
| --- | --- | --- | --- |
| Apple | iPhone 17 | 1206×2622 | iOS |
| Apple | iPhone 17 Pro | 1206×2622 | iOS |
| Apple | iPhone 17 Pro Max | 1320×2868 | iOS |
| Apple | iPhone 16 | 1179×2556 | iOS |
| Apple | iPhone 16 Pro | 1206×2622 | iOS |
| Apple | iPhone 16 Pro Max | 1320×2868 | iOS |
| Apple | iPhone 15 | 1179×2556 | iOS |
| Apple | iPhone 15 Pro Max | 1290×2796 | iOS |
| Apple | iPhone 13 | 1170×2532 | iOS |
| Apple | iPhone 14 | 1170×2532 | iOS |
| Apple | iPhone SE（第 3 代） | 750×1334 | iOS 经典 |
| Google | Google Pixel 8 | 1080×2400 | Pixel / 原生 Android |
| Google | Google Pixel 8 Pro | 1344×2992 | Pixel / 原生 Android |
| Google | Google Pixel 9 | 1080×2424 | Pixel / 原生 Android |
| Google | Google Pixel 9 Pro | 1280×2856 | Pixel / 原生 Android |
| Google | Google Pixel 9 Pro XL | 1344×2992 | Pixel / 原生 Android |
| Samsung | Samsung Galaxy S23 | 1080×2340 | One UI 6 |
| Samsung | Samsung Galaxy S24 | 1080×2340 | One UI 6 |
| Samsung | Samsung Galaxy S24+ | 1440×3120 | One UI 6 |
| Samsung | Samsung Galaxy S24 Ultra | 1440×3120 | One UI 6 |
| Samsung | Samsung Galaxy S25 | 1080×2340 | One UI 7 |
| Samsung | Samsung Galaxy S25 Ultra | 1440×3120 | One UI 7 |
| 小米 | 小米 13 | 1080×2400 | HyperOS |
| 小米 | 小米 14 | 1200×2670 | HyperOS |
| 小米 | 小米 14 Pro | 1440×3200 | HyperOS |
| 小米 | 小米 14 Ultra | 1440×3200 | HyperOS |
| 小米 | 小米 15 | 1200×2670 | HyperOS |
| Redmi | Redmi K70 | 1440×3200 | HyperOS |
| Redmi | Redmi K70 Pro | 1440×3200 | HyperOS |
| Redmi | Redmi K80 | 1440×3200 | HyperOS |
| Redmi | Redmi Note 13 Pro 5G | 1220×2712 | HyperOS |
| 华为 | 华为 P60 Pro | 1220×2700 | HarmonyOS |
| 华为 | 华为 Pura 70 | 1256×2760 | HarmonyOS |
| 华为 | 华为 Pura 70 Pro | 1260×2844 | HarmonyOS |
| 华为 | 华为 Mate 60 | 1212×2616 | HarmonyOS |
| 华为 | 华为 Mate 60 Pro | 1260×2720 | HarmonyOS |
| 华为 | 华为 Mate 70 | 1216×2688 | HarmonyOS |
| 华为 | 华为 Mate 70 Pro | 1316×2832 | HarmonyOS |
| 荣耀 | 荣耀 90 | 1200×2664 | MagicOS |
| 荣耀 | 荣耀 200 | 1200×2664 | MagicOS |
| 荣耀 | 荣耀 Magic6 | 1264×2800 | MagicOS |
| 荣耀 | 荣耀 Magic6 Pro | 1280×2800 | MagicOS |
| 荣耀 | 荣耀 Magic7 Pro | 1280×2800 | MagicOS |
| OPPO | OPPO Find X7 | 1264×2780 | ColorOS（国行） |
| OPPO | OPPO Find X7 Ultra | 1440×3168 | ColorOS（国行） |
| OPPO | OPPO Find X8 | 1256×2760 | ColorOS（国行） |
| OPPO | OPPO Find X8 Pro | 1264×2780 | ColorOS（国行） |
| OPPO | OPPO Reno12 | 1080×2412 | ColorOS（国行） |
| 一加 | 一加 12 | 1440×3168 | ColorOS（国行） |
| 一加 | 一加 13 | 1440×3168 | ColorOS（国行） |
| 一加 | 一加 Ace 3 | 1264×2780 | ColorOS（国行） |
| vivo | vivo X100 | 1260×2800 | OriginOS（国行） |
| vivo | vivo X100 Pro | 1260×2800 | OriginOS（国行） |
| vivo | vivo X200 | 1260×2800 | OriginOS（国行） |
| vivo | vivo X200 Pro | 1260×2800 | OriginOS（国行） |
| vivo | vivo X200 Pro mini | 1216×2640 | OriginOS（国行） |
| iQOO | iQOO 12 | 1260×2800 | OriginOS（国行） |
| iQOO | iQOO 13 | 1440×3168 | OriginOS（国行） |
| iQOO | iQOO Neo9 | 1260×2800 | OriginOS（国行） |
| realme | realme GT5 | 1240×2772 | realme UI |
| realme | realme GT6 | 1264×2780 | realme UI |
| realme | realme GT7 Pro | 1264×2780 | realme UI |

## 官方规格参考

本次核对的代表型号规格页面：

- [小米 14](https://www.mi.com/global/product/xiaomi-14/specs/)
- [一加 13](https://www.oneplus.com/global/13/specs)
- [OPPO Find X8](https://www.oppo.com/en/smartphones/series-find-x/find-x8/specs/)
- [vivo X200 Pro](https://www.vivo.com/en/products/param/x200-pro)
- [华为 Mate 60](https://consumer.huawei.com/cn/phones/mate60/specs/)
- [荣耀 Magic6 Pro](https://www.honor.com/global/phones/honor-magic6-pro/spec/)

已有型号标识保持兼容；原先“OPPO / vivo / 荣耀（通用安卓）”改为具体的 OPPO Find X7。Mate 60 的参考尺寸修正为 1212×2616，1260×2720 对应新增的 Mate 60 Pro。历史作品的画布尺寸不会因此自动变化。

## 自然布局与系统版本

自然布局新增 iOS 17 / 18 / 26、One UI 6 / 7、HarmonyOS 4 / 5、HyperOS 1 / 2 参考选择。默认版本按型号选择，不识别设备实际系统，选项过滤明显不适用的机型组合。其他品牌保留现有系统参考。旧版图层保持原貌，主动开启自然融合才更新。字体使用本地替代，不承诺所有版本与主题像素一致；见[自然融合指南](STATUS_BAR_FUSION.zh-CN.md)。
