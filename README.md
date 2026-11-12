# 拾字

拍照或选择图片，识别中文和英文文字，在工作台编辑后导出为 Markdown、Word 或 PDF，并通过安卓系统分享。也可以在浏览器打开使用。

## 使用

从 GitHub Releases 下载 APK，在安卓 6.0 及以上安装。从底部导航切换首页、识别和我的历史。拍照或选择图片后点「开始识别」，可直接修改识别结果，然后选择格式并保存或分享。文字会自动保存在当前设备的历史记录中，可重新打开编辑或删除；清除应用数据会删除历史记录。首次识别需要网络下载识别引擎和语言模型；识别在设备上执行。浏览器版需在 HTTPS 或 localhost 环境中使用相机，系统分享取决于浏览器支持。PDF 为图片形式，以确保中文在不同设备正常显示，文字不可选中。

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
