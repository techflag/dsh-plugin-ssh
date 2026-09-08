# DSH SSH 市场提交材料

状态：GitHub 源码与预发布包正在发布；市场目录尚未提交或审核。核对日期：2026-09-08。

## 卡片文案

名称：DSH SSH

包名：`dsh-plugin-ssh`

中文简介：在 DeepSeek Harness 内使用 SSH 多会话终端、SFTP 文件传输与编辑，并通过宿主模型获取命令建议。

英文简介：SSH terminals, SFTP file transfer and text editing inside DeepSeek Harness, with command suggestions powered by the host's configured models.

分类：`remote`

关键词：`dsh-plugin`、`deepseek-harness`、`ssh`、`sftp`、`terminal`。

版本：`0.1.0-beta.21`，预发布测试版。MIT 许可。

## 两层发布要求

### 1. 目录收录

DSH Desktop 的插件市场读取 `awesome-dsh-plugin` 目录。正式申请是在该目录提交 PR，只新增一个 `data/plugins/<owner>__<repo>.yml`，不要手工修改自动生成的 README。

目录收录要求：

- GitHub 仓库公开，且创建满 1 天；
- 仓库含真实、可运行的实现，不是 README 或占位包；
- 插件 `package.json` 声明 `dsh.bundle.patch`，并包含对应的 `cordis.patch.yml`；
- GitHub 仓库添加 `dsh-plugin` topic；
- 分类与描述准确，不使用夸大或营销措辞；
- 一个 PR 最多提交 3 个插件条目，且不修改其他插件条目；
- 源码不能包含混淆、凭据外传或异常安装行为。

截图不是必需项，但建议在插件 `package.json` 同目录添加 `screenshots.json`，声明 1–8 张仓库内的实际界面截图。

### 2. Market 一键安装

Anywhere Labs 的 Community Market 对自动安装还有额外资格判断：npm 官方 registry 的 `latest` 必须返回同名 package 和精确的稳定版本，并且 npm manifest 中仍有合法的 `dsh.bundle.patch`。当前 `0.1.0-beta.21` 是预发布版本，不满足这里的“稳定版本”条件。

如果暂不发布 npm，目录仍可收录 GitHub 仓库；也可以把预构建 `.tgz` 放到 GitHub Release，并在目录条目增加 `tarball:`。但要得到 Anywhere Labs Market 的稳定一键安装路径，推荐发布预构建的 npm `0.1.0`。

官方 `@deepseek-ai/*` 包应保持在 `peerDependencies`，并显式包含所支持的预发布版本范围；本插件已经这样声明。

## 提交位置与格式

截图中的 dsh-market 从 awesome-dsh-plugin 获取目录。支持约定目录中的 monorepo 子包，但当前插件位于仓库根级的 `dsh-plugin-ssh/`，最稳妥的发布方式是建立独立 GitHub 仓库，避免目录 CI 无法发现 package manifest。

依据：[dsh-market 提交入口](https://github.com/dsh-market/dsh-market#submit-your-plugin)、[目录贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)。

仓库创建满一天后，可向目录提交下面的条目：

```yaml
url: https://github.com/techflag/dsh-plugin-ssh
name: techflag/dsh-plugin-ssh
category: remote
description:
  en: 'SSH terminals, SFTP file transfer and text editing inside DeepSeek Harness, with command suggestions powered by the host models.'
  zh: '在 DeepSeek Harness 内使用 SSH 终端、SFTP 文件传输与文本编辑，并通过宿主模型获取命令建议。'
tarball: https://github.com/techflag/dsh-plugin-ssh/releases/latest/download/dsh-plugin-ssh.tgz
```

## PR 标题与正文草稿

标题：Add DSH SSH — SSH, SFTP and host-model assistance

正文：

> Adds DSH SSH to the remote category. It provides interactive SSH sessions, SFTP upload/download, UTF-8 text editing, saved host editing, optional locally encrypted passwords, and AI advice through Harness model services. Users can insert suggested single-line shell commands or execute them after confirmation.
>
> The package declares `dsh.bundle` and includes prebuilt Host, Client and workbench assets. Compatibility was checked with Harness 0.1.2-rc.1. This is a beta release; macOS SSH was exercised, while Windows runtime verification remains pending. Downloads are limited to 32 MB and text editing to 64 KB.
>
> Source: https://github.com/techflag/dsh-plugin-ssh
> Public package / release URL: https://github.com/techflag/dsh-plugin-ssh/releases/latest/download/dsh-plugin-ssh.tgz
> Installation command: `dsh plugin --profile web add ./dsh-plugin-ssh.tgz --ignore-scripts`
> README: https://github.com/techflag/dsh-plugin-ssh#readme

## 发布前还缺什么

1. **等待仓库满一天**：目录规则要求公开 GitHub 仓库创建满 1 天，满足后再提交收录 PR。
2. **截图**：建议展示连接中心、文件与终端分栏、`@服务器` 候选菜单和 SSH 工具卡片。使用演示主机及无敏感信息的命令；现有截图含真实服务器地址、用户名、本地路径或业务日志，不能公开。
3. **稳定版本**：当前 `0.1.0-beta.21` 可用于测试和 GitHub Release，但需发布不带预发布后缀的版本，才能满足 Community Market 的稳定 npm 自动安装条件。
4. **npm 发布**：npm 包名可用性已核对，但尚未发布。完成稳定版验收后再发布 `0.1.0`。
5. **截图清单**：当前没有 `screenshots.json`，准备好脱敏截图后补充。

## 验证记录与边界

- 本地插件检查：22 项测试通过，构建和类型检查通过。
- 通过官方 CLI 完成隔离安装、bundle 加载、页面资源和卸载检查。
- 已在 macOS 宿主验证实际 SSH 登录、终端与 SFTP 目录浏览；不将其扩写为所有功能端到端验收。
- 独立 SSH 命令通道已通过本机 SSH 测试服务器验证；宿主 Agent 到真实业务服务器的完整排查/修复流程以及 Windows 实机验收尚未完成，当前只提供测试版。
- 密码为本地文件加密方案，非系统钥匙串；读取同一用户的密钥和密文即可解密。详见 README 数据说明。

安装卡片仍显示本地路径时，代表安装来源是本地 tgz。补全包说明不会自动变成市场收录，也不保证“已安装”卡片展示完整 README；正式发现页依赖收录目录和公开分发信息。
