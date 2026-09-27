'use client';
import { useState } from 'react';
import { calculateTax2024_25, calculateTax2025_26, calculateTax2026_27 } from '../utils/taxCalculators';

// Correctly format numbers to Indian numbering system
function formatIndianCurrency(num: number) {
  if (num == null || isNaN(num)) return '₹ 0.00'; // Handle null or undefined values gracefully
  const x = num.toFixed(2);
  const afterPoint = x.substring(x.indexOf('.'));
  let beforePoint = Math.floor(num).toString();
  const lastThree = beforePoint.substring(beforePoint.length - 3);
  const otherNumbers = beforePoint.substring(0, beforePoint.length - 3);
  if (otherNumbers !== '') {
    beforePoint = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + ',' + lastThree;
  }
  return beforePoint + afterPoint;
}

export default function Home() {
  const [income, setIncome] = useState<number | string>('');
  const [results, setResults] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const incomeValue = Number(income);

    const result2024_25 = calculateTax2024_25(incomeValue);
    const result2025_26 = calculateTax2025_26(incomeValue);
    const result2026_27 = calculateTax2026_27(incomeValue);

    setResults({
      result2024_25,
      result2025_26,
      result2026_27,
    });
  };

  return (
    <div className="w-full min-h-screen py-10 px-4 md:px-10 bg-white">
      <h1 className="text-5xl font-bold text-center text-blue-600 mb-8">Income Tax Calculator</h1>
      <form className="bg-blue-50 p-6 rounded-lg shadow-lg" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center mb-6">
          <input
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="Enter your income"
            className="p-3 border border-gray-300 rounded-lg w-full md:w-1/2 mb-4 text-gray-700 bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg">
            Calculate
          </button>
        </div>
      </form>

      {results && (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Displaying 2024-25 Regime */}
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-blue-500">New Regime (2024-25)</h2>
            <p className="mt-2 text-gray-700">Income Tax: ₹ {formatIndianCurrency(results.result2024_25.tax)}</p>
            <p className="mt-1 text-gray-700">Surcharge 10%: ₹ {formatIndianCurrency(results.result2024_25.surcharge10)}</p>
            <p className="mt-1 text-gray-700">Surcharge 15%: ₹ {formatIndianCurrency(results.result2024_25.surcharge15)}</p>
            <p className="mt-1 text-gray-700">Health & Education Cess: ₹ {formatIndianCurrency(results.result2024_25.hes)}</p>
            <p className="mt-1 text-gray-700 font-bold">Total Tax: ₹ {formatIndianCurrency(results.result2024_25.totalTax)}</p>
          </div>

          {/* Displaying 2025-26 Regime */}
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-blue-500">New Regime (2025-26)</h2>
            <p className="mt-2 text-gray-700">Income Tax: ₹ {formatIndianCurrency(results.result2025_26.tax)}</p>
            <p className="mt-1 text-gray-700">Surcharge 10%: ₹ {formatIndianCurrency(results.result2025_26.surcharge10)}</p>
            <p className="mt-1 text-gray-700">Surcharge 15%: ₹ {formatIndianCurrency(results.result2025_26.surcharge15)}</p>
            <p className="mt-1 text-gray-700">Health & Education Cess: ₹ {formatIndianCurrency(results.result2025_26.hes)}</p>
            <p className="mt-1 text-gray-700 font-bold">Total Tax: ₹ {formatIndianCurrency(results.result2025_26.totalTax)}</p>
          </div>

          {/* Displaying 2026-27 Regime */}
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-blue-500">Latest Regime (2026-27)</h2>
            <p className="mt-2 text-gray-700">Income Tax: ₹ {formatIndianCurrency(results.result2026_27.tax)}</p>
            <p className="mt-1 text-gray-700">Surcharge 10%: ₹ {formatIndianCurrency(results.result2026_27.surcharge10)}</p>
            <p className="mt-1 text-gray-700">Surcharge 15%: ₹ {formatIndianCurrency(results.result2026_27.surcharge15)}</p>
            <p className="mt-1 text-gray-700">Health & Education Cess: ₹ {formatIndianCurrency(results.result2026_27.hes)}</p>
            <p className="mt-1 text-gray-700 font-bold">Total Tax: ₹ {formatIndianCurrency(results.result2026_27.totalTax)}</p>
            <p className="mt-2 text-sm text-gray-500">Tax rates are the same as the previous year (2025-26).</p>
          </div>
        </div>
      )}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  {/* Slab Breakdown for 2024-25 */}
  <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
    <h2 className="text-xl font-semibold text-blue-500">Rate of Income tax (2024-2025)</h2>
    <ul className="mt-2 text-gray-700">
      <li>₹3,00,000 - ₹7,00,000 :- 5%</li>
      <li>₹7,00,000 - ₹10,00,000 :- 10%</li>
      <li>₹10,00,000 - ₹12,00,000 :- 15%</li>
      <li>₹12,00,000 - ₹15,00,000 :- 20%</li>
      <li>₹15,00,000 {'>'} :- 30%</li>
      <li>Health & Education Cess : 4%</li>
      <li>₹50,00,000 - ₹1,00,00,000:- Surcharge of 10%</li>
      <li>₹1,00,00,000 {'>'} :- Surcharge of 15%</li>
    </ul>
  </div>

  {/* Slab Breakdown for 2025-26 */}
  <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
    <h2 className="text-xl font-semibold text-blue-500">Rate of Income tax (2025-2026)</h2>
    <ul className="mt-2 text-gray-700">
      <li>₹0 - ₹4,00,000 :- Nil</li>
      <li>₹4,00,001 - ₹8,00,000 :- 5%</li>
      <li>₹8,00,001 - ₹12,00,000 :- 10%</li>
      <li>₹12,00,001 - ₹16,00,000 :- 15%</li>
      <li>₹16,00,001 - ₹20,00,000 :- 20%</li>
      <li>₹20,00,001 - ₹24,00,000 :- 25%</li>
      <li>₹24,00,000 {'>'} :- 30%</li>
      <li>Health & Education Cess : 4%</li>
      <li>₹50,00,000 - ₹1,00,00,000:- Surcharge of 10%</li>
      <li>₹1,00,00,000 {'>'} :- Surcharge of 15%</li>
    </ul>
  </div>

  {/* Slab Breakdown for 2026-27 */}
  <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
    <h2 className="text-xl font-semibold text-blue-500">Rate of Income tax (2026-2027)</h2>
    <p className="mt-2 px-3 py-2 text-sm text-blue-800 bg-blue-50 rounded-md">
      For the financial year 2026-27, the income tax rates are the same as the previous year (2025-26).
    </p>
    <ul className="mt-2 text-gray-700">
      <li>₹0 - ₹4,00,000 :- Nil</li>
      <li>₹4,00,001 - ₹8,00,000 :- 5%</li>
      <li>₹8,00,001 - ₹12,00,000 :- 10%</li>
      <li>₹12,00,001 - ₹16,00,000 :- 15%</li>
      <li>₹16,00,001 - ₹20,00,000 :- 20%</li>
      <li>₹20,00,001 - ₹24,00,000 :- 25%</li>
      <li>₹24,00,000 {'>'} :- 30%</li>
      <li>Health & Education Cess : 4%</li>
      <li>₹50,00,000 - ₹1,00,00,000:- Surcharge of 10%</li>
      <li>₹1,00,00,000 {'>'} :- Surcharge of 15%</li>
    </ul>
  </div>
</div>

    </div>
  );
}
