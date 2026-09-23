# AI 創新微課程　Taiwan Weather Forecast

**從氣象資料到互動式天氣預報應用**

> 用程式探索天氣、用資料看見台灣、用 AI 實現更多可能  
> Code Smarter · Build a Better Tomorrow

**技術棧：** CWA API × JSON × Python × SQLite × Streamlit

與你一起用 AI 寫程式，探索更大的世界。

> 「技術可以解決問題，但更重要的是用技術創造更好的未來！」  
> — 煥哥

---

## 課程簡介

本專案對應「AI 創新微課程」實作路線：**AI × 資料 × 天氣 × 實作**。  
從中央氣象署（CWA）開放資料取得預報 JSON，解析最高／最低氣溫，寫入 SQLite，再用 Streamlit 做出可選地區、折線圖、表格與台灣地圖的互動式天氣預報應用。

| 面向 | 內容 |
|------|------|
| 課程目標 | 串接公開氣象 API、整理資料、建立資料庫、完成互動 Web App |
| 學習地圖 | 資料取得 → JSON 解析 → SQLite → Streamlit 儀表板 |
| 專案成果 | Taiwan Weather Dashboard（選地區看氣溫週報） |

---

## 學習地圖（24 步）

### 基礎與資料來源

| # | 單元 | 重點 |
|---|------|------|
| 1 | **課程介紹** | 課程目標、學習地圖、專案成果展示 |
| 2 | **台灣的天氣與生活** | 天氣影響生活、資料驅動決策、智慧應用案例 |
| 3 | **中央氣象署 CWA Open Data 平台** | 註冊帳號、取得 API Key、選擇資料集 |
| 4 | **API 資料取得** | 使用 `requests` 取得 JSON（Authorization header） |

### 資料處理與資料庫

| # | 單元 | 重點 |
|---|------|------|
| 5 | **JSON 資料結構解析** | 找到氣溫位置：`locations` → `weatherElement` → `MinT` / `MaxT` |
| 6 | **提取最高與最低氣溫** | 解析 JSON、提取 MinT / MaxT、轉成結構化資料 |
| 7 | **資料整理與預覽** | 使用 Pandas 觀察資料（地區、日期、mint、maxt） |
| 8 | **建立 SQLite 資料庫** | `data.db`：建立資料庫、建立資料表、插入氣溫資料 |
| 9 | **資料庫設計 TemperatureForecasts** | `id`, `regionName`, `dataDate`, `mint`, `maxt` |
| 10 | **查詢資料驗證** | 用 SQL 檢查資料（例如依地區篩選） |

### Streamlit 互動應用

| # | 單元 | 重點 |
|---|------|------|
| 11 | **Streamlit 入門** | 安裝環境、基本結構、Hello World |
| 12 | **從資料庫讀取資料** | `sqlite3` + `pandas.read_sql_query` |
| 13 | **下拉選單選擇地區** | 互動式操作（北部／南部／東北／東部／南部地區等） |
| 14 | **繪製折線圖** | 一週最高與最低氣溫（MaxT / MinT） |
| 15 | **顯示資料表格** | 清楚呈現一週預報（Date、MinT、MaxT） |
| 16 | **整合 Web App 介面** | Taiwan Weather Forecast：選地區看氣溫週報 |

### 進階視覺化與成果

| # | 單元 | 重點 |
|---|------|------|
| 17 | **進階：台灣地圖視覺化** | Folium + Streamlit；依平均氣溫著色 |
| 18 | **選擇日期顯示地圖** | 互動式天氣地圖（選定日期顯示該日 Min / Max） |
| 19 | **完整成果展示** | Taiwan Weather Dashboard |
| 20 | **程式碼品質與優化** | 結構清晰、錯誤處理、重複執行不重複插入、良好註解 |

### 版本控管與延伸

| # | 單元 | 重點 |
|---|------|------|
| 21 | **專案上傳至 GitHub** | 建立 Repository、連遠端、Commit & Push |
| 22 | **延伸應用與想法** | 天氣提醒 Line Bot、旅遊行程建議、農業／防災應用、結合 AI 做分析 |
| 23 | **回顧與重點整理** | API 資料取得、JSON 資料分析、SQLite 資料庫、Streamlit Web App、AI × Coding 實作流程 |
| 24 | **下一步：繼續探索** | 更多公開資料 API、資料視覺化應用、AI 協助開發、打造自己的專案作品 |

---

## 資料庫設計

資料表名稱：`TemperatureForecasts`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | INTEGER PRIMARY KEY | 主鍵 |
| `regionName` | TEXT | 地區名稱 |
| `dataDate` | TEXT | 預報日期 |
| `mint` | REAL | 最低氣溫（MinT） |
| `maxt` | REAL | 最高氣溫（MaxT） |

範例資料：

| regionName | dataDate | mint | maxt |
|------------|----------|------|------|
| 北部地區 | 2026-04-14 | 18 | 26 |
| 中部地區 | 2026-04-14 | 20 | 30 |
| 南部地區 | 2026-04-14 | 22 | 31 |

---

## 查詢範例

```sql
SELECT DISTINCT regionName
FROM TemperatureForecasts;

SELECT *
FROM TemperatureForecasts
WHERE regionName = '中部地區';
```

從 Python 讀取：

```python
import sqlite3
import pandas as pd

conn = sqlite3.connect("data.db")
df = pd.read_sql_query("SELECT * FROM TemperatureForecasts", conn)
```

---

## 應用功能（對應單元 13–19）

- 下拉選單選擇地區
- 一週最高／最低氣溫折線圖
- 一週預報資料表格
- 整合介面：Taiwan Weather Forecast
- （進階）Folium 台灣地圖視覺化與日期選擇

---

## 程式碼品質原則（單元 20）

- 程式結構清晰
- 具備錯誤處理機制
- 重複執行時不重複插入資料
- 良好的註解

---

## 你學會了什麼？（單元 23）

- [ ] API 資料取得
- [ ] JSON 資料分析
- [ ] SQLite 資料庫
- [ ] Streamlit Web App
- [ ] AI × Coding 實作流程

---

## 下一步（單元 24）

- 嘗試更多公開資料 API
- 把資料做成視覺化應用
- 用 AI 協助開發
- 打造屬於自己的專案作品

**Learn Today · Build Tomorrow**  
*AI for Learning · AI for a Better Taiwan*
