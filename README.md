# 拾字

拍照或选择图片，识别中文和英文文字，在工作台编辑后导出为 Markdown、Word 或 PDF，并通过安卓系统分享。也可以在浏览器打开使用。

## 使用

从 GitHub Releases 下载 APK，在安卓 6.0 及以上安装。底部导航固定显示首页、识别和我的历史。

在识别页可以拍照或批量选择图片，逐张选择矩形框选或自由手绘选区，不设置选区则识别整张图片。识别按图片选择顺序拼接，完成后自动进入文字整理页。整理页支持字号、粗体、斜体、下划线、列表和表格，最后选择 Markdown、Word 或 PDF 导出分享。Markdown 不支持字号；PDF 为图片页面，文字不可选中。

中英文识别引擎和模型随安装包提供，安装后无需联网下载，识别在设备本地完成。浏览器版需在 HTTPS 或 localhost 环境中使用相机，系统分享取决于浏览器支持。

图片、选区和文字自动保存在设备本地，历史最多 100 条；可以打开记录，增删图片、继续识别、编辑文字或导出，也可以删除单条记录或清空历史。新增图片的识别结果会追加到原有文字；删除图片不会删除已识别的文字。清除应用数据或卸载应用会删除本地历史，重要内容请先导出。

安卓的「保存文件」会打开系统分享面板，可选择文件管理器或云盘保存；「导出并分享」可选择微信等支持接收文件的应用。

## 开发

需要 Node.js 20、Java 21 和 Android SDK 35。

```sh
npm ci
npm run dev
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

## 版本和发布

使用语义化版本：不兼容或重大功能变化调整主版本，一般功能调整次版本，小修复调整修订号。发布时同步修改 `package.json`、`package-lock.json` 和 `android/app/build.gradle` 的 `versionName`；每次发布都递增 `versionCode`。提交后推送 `v1.0.0` 这样的标签，GitHub Actions 自动构建 APK 并创建 Release。

为了确保安装包可持续覆盖升级，请在仓库 Actions secrets 中配置 `ANDROID_KEYSTORE_BASE64`（签名文件的 base64）、`ANDROID_STORE_PASSWORD`、`ANDROID_KEY_ALIAS` 和 `ANDROID_KEY_PASSWORD`，并妥善保管签名文件。未配置时工作流使用临时调试签名生成可安装的测试包；不同构建之间签名可能不同，无法覆盖升级。不要将签名文件或密码提交到仓库。
