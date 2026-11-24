# Eve-language

Eve語（アルファベット・数字の置きかえ文字）を学んだり、文章や写真の文字をEve文字に変えたりできる、非公式のファン向けWebアプリです。

- `index.html` … 画面とスタイル（Claude Artifact 形式なので `<!doctype>` と `<head>` はありません）
- `app.js` … 変換・魔法の演出・カメラ（OCR）・学習モード
- `glyphs.js` … Eve語表の画像からトレースした36文字のアウトライン
- `vendor/` … kuromoji（漢字の読み）と tesseract.js（文字の読み取り）。データは `.b64.txt`（base64）で同梱し、どの静的ホスティングでも配信できるようにしています。この形式に合わせて `vendor/kuromoji.js` と `vendor/worker.min.js` に小さなパッチを当てています。

## GitHub Pages で公開する

```bash
./build-pages.sh
```

`dist/` に公開用の一式（約0.5MB）ができます。漢字の辞書と文字読み取りのデータは、公開版では jsDelivr（CDN）から読み込みます。`dist/` の中身をリポジトリに置き、Settings → Pages で公開してください。HTTPSで配信されるので、カメラのライブ映像も使えます。

ライセンス: kuromoji（Apache-2.0、辞書はIPADIC: `vendor/NOTICE-kuromoji-ipadic.md`）、tesseract.js / tesseract.js-core（Apache-2.0）。`vendor/LICENSE-*` を消さずに一緒に公開してください。
