# ListenSub

在 YouTube 原分頁播放影片，在 ListenSub 分頁閱讀自行貼上的字幕。字幕文字只存在本機。

## 如何操作

1. 到 `chrome://extensions` 開啟「開發人員模式」。
2. 按「載入未封裝項目」，選取含有 `manifest.json` 的 ListenSub 資料夾。
3. 開啟 YouTube 影片並播放，再按工具列上的 ListenSub 圖示。
4. 展開「Paste a transcript with timestamps」，貼上帶時間碼的逐字稿，按「Use transcript」。
5. 在 ListenSub 頁面按 Play／Pause，可控制原本的 YouTube 分頁。

支援每行一段的格式，例如 `[00:00:04] My first sentence`，也支援 SRT／VTT。

## 建議 transcript 網址

[https://youtubetotranscript.com/](https://youtubetotranscript.com/)

複製帶時間碼的逐字稿，再貼到 ListenSub。

## 目前已有功能

- 依 YouTube 播放時間顯示手動貼上的字幕，以及前後文。
- 播放／暫停原 YouTube 分頁。
- 字體大小調整、字幕頁重新連線、多個 YouTube 分頁切換。
- 本機保存貼上的逐字稿。

## 目前尚未支援

- 自動擷取或產生 YouTube transcript，需自行複製貼上。
- 上一句／下一句箭頭跳轉功能。
- 尚未在不同影片與 Chrome 環境完整驗證所有情況。
