# BharatIncomeTaxSlabCalculator [income-tax.amaanabbasi.me](https://income-tax.amaanabbasi.me/)

![Screenshot from 2024-10-21 00-18-58](https://github.com/user-attachments/assets/82f78b0b-e6d0-47e9-878e-aad94eccf117)


## Salary & Tax Desk ([/payroll](https://income-tax.amaanabbasi.me/payroll))

Upload an office "Statement of Salary" workbook (one employee, one sheet per employee, or many employees stacked in one sheet) and get monthly pay slips and the full income-tax computation (slabs, 87A rebate and marginal relief, surcharge and its marginal relief, 4% cess, 288A/288B rounding, TDS balance), with both regimes compared. A file with many employees gets a summary table, one Excel workbook for everyone, and print-all for tax computations and pay slips. Files are read in the browser; nothing is uploaded and no AI is involved.

- `src/payroll/format/salaryStatement.ts`: the statement layout and its 17 columns, with the formulas each one uses.
- `src/payroll/rules/taxRules.ts`: slabs and limits for FY 2024-25, 2025-26 and tax year 2026-27.
- `src/payroll/engine/`: annual totals, the tax computation and pay slips.
- `src/payroll/excel/`: reading and checking uploaded workbooks (with cell-by-cell messages), and writing the statement, tax sheet and template back to Excel.
- `npm test` runs the unit tests.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm install
# then
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# bharat-income-tax-slab-calculator
