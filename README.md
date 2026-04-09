# kookat

`kookat` 是一个纯静态个人首页。

页面采用星空 / 星云 / 深空轨道的视觉语言：

- 中央区域只展示站点标题和持续公转的项目标题
- 底部区域展示项目标题、简介和跳转入口
- 不使用卡片、边框、圆角框等界面容器

适合挂在个人域名根路径，作为几个项目的统一入口。

## 配置项目

项目内容写在 [projects.config.js](./projects.config.js)。

每一项只需要这三个字段：

```js
{
  name: "项目名",
  description: "一句简介",
  href: "https://你的链接"
}
```

说明：

- `name` 会同时出现在中间轨道和底部列表
- `description` 只出现在底部列表
- `href` 是点击后的跳转地址

## 本地预览

在项目目录运行：

```bash
python3 -m http.server 4173
```

然后访问：

```text
http://127.0.0.1:4173
```

## 发布前检查

上线前建议确认这几件事：

- 把 [projects.config.js](projects.config.js) 里的示例链接全部换成真实地址
- 检查每个 `href` 是否可访问，避免跳到占位页
- 在桌面端和手机端各看一遍，确认轨道文字没有互相遮挡
- 如果部署环境限制外链字体，记得处理 Google Fonts 的可用性

## 文件说明

- [index.html](index.html)：页面结构与文案
- [styles.css](styles.css)：视觉、排版、动效、响应式
- [app.js](app.js)：星点、流星、轨道动画、项目渲染
- [projects.config.js](projects.config.js)：项目配置

## 部署

这是纯静态站点，不需要构建。

把下面这些文件直接部署到静态托管即可：

- `index.html`
- `styles.css`
- `app.js`
- `projects.config.js`

常见托管方式包括 GitHub Pages、Vercel 静态站点、Netlify，或者任何支持静态文件分发的 Nginx / CDN。
