# E-14 Electoral Comparison Dashboard

This application compares projected voter data from a "Día D" Excel file against actual voting results extracted from E-14 PDFs using Gemini's Vision API.

## Features
- **PDF Extraction**: Automated data extraction from handwritten E-14 forms using Google Gemini Pro Vision.
- **Smart Matching**: Fuzzy logic and keyword-based identification of voting venues between Día D and E-14 files.
- **Visual Dashboard**: Real-time effectiveness metrics, individual voter tracking, and "shared leader" alerts.
- **Semaphore System**: Visual green/red indicators for vote-counting benchmarks.

## Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd quindio/pdf_processor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure the environment**:
   Create a `.env` file in the `pdf_processor` folder:
   ```env
   GEMINI_API_KEY=your_google_ai_studio_api_key
   ```

4. **Prepare Data**:
   Place your files in the root folder (`../` relative to `pdf_processor`):
   - `dia d (9).xlsx`
   - `Resultados_E14_Gemini_Final.xlsx`

5. **Run the dashboard**:
   ```bash
   node server_dashboard.js
   ```
   Open `http://localhost:4000` in your browser.

## Technologies
- **Backend**: Node.js, Express.
- **OCR/AI**: Google Gemini.
- **Frontend**: Tailwind CSS, Chart.js.
- **Storage**: Excel (via `xlsx` library).

> [!IMPORTANT]
> This repository contains only the application code. Data files (.xlsx, .pdf) containing personal voter information are excluded for security.
