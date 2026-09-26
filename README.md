# Executive Sales & Retail Analytics Dashboard

An interactive retail analytics dashboard built from the Superstore dataset. The project combines Python-based data preparation with a React and TypeScript web application to explore sales, profitability, customer segments, product trends, and regional performance.

## Links

- [Live Dashboard](https://haiderimran019.github.io/Sales-Data-Dashboard/)
- [GitHub Repository](https://github.com/haiderimran019/Sales-Data-Dashboard)

## Project Overview

This project demonstrates an end-to-end data analytics workflow:

1. Raw retail data is cleaned and validated with Python and pandas.
2. Jupyter notebooks are used for exploratory data analysis and feature engineering.
3. A cleaned CSV file is prepared for the web application.
4. The React and TypeScript dashboard loads and analyzes the data in the browser.
5. GitHub Actions builds and deploys the application to GitHub Pages.

The dashboard is intended for educational and portfolio use. It demonstrates how cleaned business data can be transformed into interactive analytical views.

## Key Features

### Executive Overview

- Total sales.
- Total profit.
- Profit margin.
- Total orders.
- Average order value.
- Interactive date filtering.
- Dynamic KPI calculations.

### Sales Performance

- Monthly sales trends.
- Quarterly sales trends.
- Regional sales distribution.
- Category performance.
- Interactive charts and filters.

### Profitability Analysis

- Profit and margin analysis.
- Discount impact visualization.
- Identification of low-profit or loss-making categories.
- Profitability comparisons across products and regions.

### Customer Insights

- Customer value metrics.
- Order-frequency analysis.
- Customer-segment breakdown.
- Consumer, Corporate, and Home Office comparisons.

### Product Explorer

- Searchable product table.
- Multi-column sorting.
- Sub-category filtering.
- Product-level sales and profitability information.
- Data export functionality, where supported.

### Business Insights

- Automatically generated analytical summaries.
- Data-preparation explanations.
- Key operational patterns from the dataset.

### Interactive Controls

- Date-range filtering.
- CSV file import.
- Light and dark modes.
- Responsive charts.
- Sortable tables.
- Responsive layout for different screen sizes.

## Technology Stack

### Data Preparation and Analysis

- Python.
- pandas.
- Jupyter Notebook.
- Exploratory data analysis.
- Data cleaning.
- Feature engineering.
- CSV processing.

### Frontend and User Interface

- React 18.
- TypeScript.
- Vite.
- Tailwind CSS.
- Recharts.
- React Router.
- Framer Motion.
- Lucide React.
- Papa Parse.

### Deployment

- GitHub Actions.
- GitHub Pages.
- Automated build and deployment workflow.

## Data Pipeline

### 1. Extraction and Cleaning

Python and pandas notebooks are used to:

- Inspect the raw data.
- Remove duplicate records where appropriate.
- Handle missing or invalid values.
- Format date columns.
- Create analytical fields such as profit margin.
- Export a cleaned CSV file.

### 2. Asset Preparation

The build process copies the cleaned CSV file into the web application's public assets directory.

The actual location of the data-copy script should match the repository structure. In this repository, the script is expected to be located at:

```text
webapp/copy-data.mjs
