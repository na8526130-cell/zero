# ZERO-tube - デプロイガイド (Render / Vercel / GAS)

YouTube API v3 & YouTube Education プレイヤーを統合した、セーフブラウジング対応の高速・多機能Webアプリケーションです。

---

## 🚀 デプロイ設定の準備（完了済み）

本リポジトリには、**Render**、**Vercel**、および完全無料運用の **Google Apps Script (GAS)** へ直接デプロイするための設定ファイルがすべて同梱されています。

| ファイル名 | 用途 |
|---|---|
| `render.yaml` | **Render** 用の1クリック自動デプロイ設定（Blueprint） |
| `vercel.json` | **Vercel** 用のルーティング・Serverless Function設定 |
| `api/index.ts` | **Vercel** サーバーレスAPIエントリーポイント |
| `server.ts` | **Render** / Node.js サーバー用エントリーポイント（動的PORT対応） |
| `package.json` | ビルドスクリプト (`npm run build`) & 起動コマンド (`npm start`) |

---

## 1. 🐙 GitHubへリポジトリをプッシュする手順

1. AI Studio画面右上の **「GitHubにエクスポート」** ボタンから自身のGitHubアカウントにコードをプッシュします。
2. （またはGitでリポジトリを作成し、コミット・プッシュします）

---

## 2. 🔷 Render（レンダー）でのデプロイ手順

RenderはNode.jsサーバーを常時稼働させるのに最適なホスティングサービスです。

### 方法A: Blueprint自動連携（最も簡単・おすすめ）
1. [Render Dashboard](https://dashboard.render.com/) にログインします。
2. 右上の **「New +」** → **「Blueprint」** を選択します。
3. GitHubアカウントを連携し、このリポジトリを選択します。
4. リポジトリ内の `render.yaml` が自動検出され、**「Apply」** を押すだけで全自動デプロイされます！

### 方法B: 手動設定（Web Service）
1. [Render Dashboard](https://dashboard.render.com/) で **「New +」** → **「Web Service」** を選択。
2. GitHubリポジトリを選択。
3. 各設定項目に以下を入力:
   - **Name**: `zero-tube`（任意）
   - **Environment / Runtime**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. **Environment Variables（環境変数）**:
   - `NODE_ENV`: `production`
   - `PORT`: *(Renderが自動割り当てするため設定不要)*
   - `YOUTUBE_API_KEY`: *(任意: ご自身のYouTube Data API v3キー)*
   - `GEMINI_API_KEY`: *(任意: AI要約機能を利用する場合)*
5. **「Deploy Web Service」** をクリックします。数分でビルドが完了し、公開URLが発行されます！

---

## 3. ▲ Vercel（バーセル）でのデプロイ手順

Vercelは超高速なCDN配信とサーバーレスAPI実行が可能なホスティングサービスです。

### デプロイ手順：
1. [Vercel Dashboard](https://vercel.com/dashboard) にログインします。
2. **「Add New...」** → **「Project」** を選択します。
3. GitHubリポジトリを選択し、**「Import」** をクリックします。
4. **Framework Preset**: `Vite` が自動選択されます（そのままでOK）。
5. **Root Directory**: `./`（デフォルトのまま）
6. **Build and Output Settings**:
   - `vercel.json` が同梱されているため、自動的に `npm run build` と `dist` 出力が適用されます。
7. **Environment Variables（環境変数）**:
   - 必要に応じて `YOUTUBE_API_KEY` や `GEMINI_API_KEY` を追加（未設定でもビルトインプロトコルで動作します）。
8. **「Deploy」** をクリックします。
   - 約1分でビルドが完了し、`https://xxx.vercel.app` が公開されます！
   - フロントエンド（`dist`）とバックエンドAPI（`/api/*`）がシームレスに連動します。

---

## 4. 📜 Google Apps Script (GAS) 版でのデプロイ手順（完全無料・サーバー不要）

サーバー契約なしで永久無料運用したい場合は、Google Apps Scriptのウェブアプリとしてもデプロイ可能です。

1. [Google Apps Script (script.google.com)](https://script.google.com/) で新規プロジェクトを作成します。
2. プロジェクト内の `Code.gs` に、本リポジトリの **`gas/Code.gs`** の内容を貼り付けます。
3. 左メニューの「＋」から「HTML」ファイルを追加し、ファイル名を **`index`** にします。
4. `index.html` に、本リポジトリの **`gas/index.html`** の内容を貼り付けます。
5. 右上の「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を選択:
   - **次のユーザーとして実行**: `自分`
   - **アクセスできるユーザー**: `全員 (Anyone)`
6. 発行されたURLを開くと、即座にWebアプリとして動作します！

---

## 🛠 ローカル開発コマンド

```bash
# 開発サーバー起動 (ポート 3000)
npm run dev

# 本番用ビルド (Vite + Expressバンドル)
npm run build

# 本番サーバー起動
npm run start

# 型チェック
npm run lint
```
