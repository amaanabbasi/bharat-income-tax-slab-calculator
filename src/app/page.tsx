'use client';
import { useState } from 'react';
import { calculateTax2019_20, calculateTax2020_21, calculateTax2024_25 } from '../utils/taxCalculators';

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

    const result2019_20 = calculateTax2019_20(incomeValue);
    const result2020_21 = calculateTax2020_21(incomeValue);
    const result2024_25 = calculateTax2024_25(incomeValue);

    setResults({
      result2019_20,
      result2020_21,
      result2024_25,
    });
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-10 bg-white">
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
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Displaying 2019-20 Regime */}
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-blue-500">Old Regime (2019-20)</h2>
            <p className="mt-2 text-gray-700">Income Tax: ₹ {formatIndianCurrency(results.result2019_20.tax)}</p>
            <p className="mt-1 text-gray-700">Surcharge 10%: ₹ {formatIndianCurrency(results.result2019_20.surcharge10)}</p>
            <p className="mt-1 text-gray-700">Surcharge 15%: ₹ {formatIndianCurrency(results.result2019_20.surcharge15)}</p>
            <p className="mt-1 text-gray-700">Health & Education Cess: ₹ {formatIndianCurrency(results.result2019_20.hes)}</p>
            <p className="mt-1 text-gray-700 font-bold">Total Tax: ₹ {formatIndianCurrency(results.result2019_20.totalTax)}</p>
          </div>

          {/* Displaying 2020-21 Regime */}
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-blue-500">Middle Regime (2020-21)</h2>
            <p className="mt-2 text-gray-700">Income Tax: ₹ {formatIndianCurrency(results.result2020_21.tax)}</p>
            <p className="mt-1 text-gray-700">Surcharge 10%: ₹ {formatIndianCurrency(results.result2020_21.surcharge10)}</p>
            <p className="mt-1 text-gray-700">Surcharge 15%: ₹ {formatIndianCurrency(results.result2020_21.surcharge15)}</p>
            <p className="mt-1 text-gray-700">Health & Education Cess: ₹ {formatIndianCurrency(results.result2020_21.hes)}</p>
            <p className="mt-1 text-gray-700 font-bold">Total Tax: ₹ {formatIndianCurrency(results.result2020_21.totalTax)}</p>
          </div>

          {/* Displaying 2024-25 Regime */}
          <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-blue-500">New Regime (2024-25)</h2>
            <p className="mt-2 text-gray-700">Income Tax: ₹ {formatIndianCurrency(results.result2024_25.tax)}</p>
            <p className="mt-1 text-gray-700">Surcharge 10%: ₹ {formatIndianCurrency(results.result2024_25.surcharge10)}</p>
            <p className="mt-1 text-gray-700">Surcharge 15%: ₹ {formatIndianCurrency(results.result2024_25.surcharge15)}</p>
            <p className="mt-1 text-gray-700">Health & Education Cess: ₹ {formatIndianCurrency(results.result2024_25.hes)}</p>
            <p className="mt-1 text-gray-700 font-bold">Total Tax: ₹ {formatIndianCurrency(results.result2024_25.totalTax)}</p>
          </div>
        </div>
      )}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
  {/* Slab Breakdown for 2019-20 */}
  <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
    <h2 className="text-xl font-semibold text-blue-500">Rate of Income tax (2019-2020)</h2>
    <ul className="mt-2 text-gray-700">
      <li>₹2,50,000 - ₹5,00,000 :- 5%</li>
      <li>₹5,00,000 - ₹10,00,000 :- 20%</li>
      <li>₹10,00,000 > :- 30%</li>
      <li>Health & Education Cess : 4%</li>
      <li>₹50,00,000 - ₹1,00,00,000:- Surcharge of 10%</li>
      <li>₹1,00,00,000 > :- Surcharge of 15%</li>
    </ul>
  </div>

  {/* Slab Breakdown for 2020-21 */}
  <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
    <h2 className="text-xl font-semibold text-blue-500">Rate of Income tax (2020-2021)</h2>
    <ul className="mt-2 text-gray-700">
      <li>₹2,50,000 - ₹5,00,000 :- 5%</li>
      <li>₹5,00,000 - ₹7,50,000 :- 10%</li>
      <li>₹7,50,000 - ₹10,00,000 :- 15%</li>
      <li>₹10,00,000 - ₹12,50,000 :- 20%</li>
      <li>₹12,50,000 - ₹15,00,000 :- 25%</li>
      <li>₹15,00,000 > :- 30%</li>
      <li>Health & Education Cess : 4%</li>
      <li>₹50,00,000 - ₹1,00,00,000:- Surcharge of 10%</li>
      <li>₹1,00,00,000 > :- Surcharge of 15%</li>
    </ul>
  </div>

  {/* Slab Breakdown for 2024-25 */}
  <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
    <h2 className="text-xl font-semibold text-blue-500">Rate of Income tax (2024-2025)</h2>
    <ul className="mt-2 text-gray-700">
      <li>₹3,00,000 - ₹7,00,000 :- 5%</li>
      <li>₹7,00,000 - ₹10,00,000 :- 10%</li>
      <li>₹10,00,000 - ₹12,00,000 :- 15%</li>
      <li>₹12,00,000 - ₹15,00,000 :- 20%</li>
      <li>₹15,00,000 > :- 30%</li>
      <li>Health & Education Cess : 4%</li>
      <li>₹50,00,000 - ₹1,00,00,000:- Surcharge of 10%</li>
      <li>₹1,00,00,000 > :- Surcharge of 15%</li>
    </ul>
  </div>
</div>

    </div>
  );
}
