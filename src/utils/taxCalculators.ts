export function calculateTax2019_20(totalincome: number) {
  let income = totalincome;
  let tax = 0;
  let surcharge10 = 0;
  let surcharge15 = 0;
  let totalTax = 0;

  // If total income is less than 250000, no tax to be paid
  while (income > 250000) {
    // No tax on 250000 slab
    income = totalincome - 250000;

    // 5% slab
    if (income >= 250000) {
      tax += 250000 * (5 / 100);
      income = totalincome - 500000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (5 / 100); // Apply 5% tax on remaining income
      break;
    }

    // 20% slab
    if (income >= 500000) {
      tax += 500000 * (20 / 100);
      income = totalincome - 1000000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (20 / 100);
      break;
    }

    // 30% slab
    if (totalincome >= 1000000) {
      income = totalincome - 1000000;
      tax += income * (30 / 100);
    }

    // 10% surcharge
    if (totalincome > 5000000 && totalincome <= 10000000) {
      surcharge10 = tax * (10 / 100);
      tax += surcharge10;
      break;
    }

    // 15% surcharge
    if (totalincome > 10000000) {
      income = totalincome - 10000000;
      surcharge15 = tax * (15 / 100);
      tax += surcharge15;
      break;
    }

    break;
  }

  // Health and Education Cess (HES)
  const hes_tax = 4;
  const hes = tax * (hes_tax / 100); // Apply 4% HES on total tax

  totalTax = tax + hes; // Total tax including HES

  return {
    tax: tax || 0,
    hes: hes || 0,
    surcharge10: surcharge10 || 0,
    surcharge15: surcharge15 || 0,
    totalTax: totalTax || 0,
  };
}
export function calculateTax2020_21(totalincome: number) {
  let income = totalincome;
  let tax = 0;
  let surcharge10 = 0;
  let surcharge15 = 0;
  let totalTax = 0;
  const slab = 250000;

  // If total income is less than 250000, no tax to be paid
  while (income > 250000) {
    // No tax on 250000 slab
    income = totalincome - 250000;

    // 5% slab
    if (totalincome >= 250000 && income > 250000) {
      tax += 250000 * (5 / 100);
      income = income - slab;
      console.log(`5% tax on Rs. ${250000}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    } else if (income > 0) {
      tax += income * (5 / 100);
      income = income - slab;
      console.log(`5% tax on Rs. ${income}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    }

    // 10% slab
    if (totalincome >= 500000 && income > 250000) {
      tax += 250000 * (10 / 100);
      income = income - slab;
      console.log(`10% tax on Rs. ${250000}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    } else if (income > 0) {
      tax += income * (10 / 100);
      income = income - slab;
      console.log(`10% tax on Rs. ${income}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    }

    // 15% slab
    if (totalincome >= 750000 && income > 250000) {
      tax += 250000 * (15 / 100);
      income = income - slab;
      console.log(`15% tax on Rs. ${250000}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    } else if (income > 0) {
      tax += income * (15 / 100);
      income = income - slab;
      console.log(`15% tax on Rs. ${income}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    }

    // 20% slab
    if (totalincome >= 1000000 && income > 250000) {
      tax += 250000 * (20 / 100);
      income = income - slab;
      console.log(`20% tax on Rs. ${250000}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    } else if (income > 0) {
      tax += income * (20 / 100);
      income = income - slab;
      console.log(`20% tax on Rs. ${income}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    }

    // 25% slab
    if (totalincome >= 1250000 && income > 250000) {
      tax += 250000 * (25 / 100);
      income = income - slab;
      console.log(`25% tax on Rs. ${250000}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    } else if (income > 0) {
      tax += income * (25 / 100);
      income = income - slab;
      console.log(`25% tax on Rs. ${income}, Remaining Rs. ${income}, Total Tax Rs. ${tax}`);
    }

    // 30% slab
    if (totalincome >= 1500000) {
      income = totalincome - 1500000;
      tax += income * (30 / 100);
      console.log(`30% tax on Rs. ${income}, Total Tax Rs. ${tax}`);
    }

    // 10% surcharge
    if (totalincome > 5000000 && totalincome <= 10000000) {
      surcharge10 = tax * (10 / 100);
      tax += surcharge10;
      console.log(`10% surcharge on Rs. ${tax}, Total Tax Rs. ${tax}`);
      break;
    }

    // 15% surcharge
    if (totalincome > 10000000) {
      income = totalincome - 10000000;
      surcharge15 = tax * (15 / 100);
      tax += surcharge15;
      console.log(`15% surcharge on Rs. ${tax}, Total Tax Rs. ${tax}`);
      break;
    }

    break;
  }

  const hes_tax = 4;
  const hes = tax * (hes_tax / 100); // HES Health And Education Cess
  totalTax = hes + tax;

  return {
    tax,
    hes,
    surcharge10,
    surcharge15,
    totalTax,
  };
}

export function calculateTax2024_25(totalincome: number) {
  let income = totalincome;
  let tax = 0;
  let surcharge10 = 0;
  let surcharge15 = 0;
  let totalTax = 0;
  const slab = 300000; // Adjusted for the new tax regime

  // No tax on the first 3,00,000
  if (income <= 300000) {
    console.log("No tax!");
    return { tax, hes: 0, surcharge10: 0, surcharge15: 0, totalTax: 0 };
  }

  income -= 300000; // Adjust after 3,00,000 slab

  // 5% slab (3,00,001 - 7,00,000)
  if (totalincome > 300000 && income > 0) {
    const slab_income = Math.min(400000, income);
    tax += slab_income * 0.05;
    income -= slab_income;
    console.log(`5% tax on Rs. ${slab_income}, Total Tax Rs. ${tax}`);
  }

  // 10% slab (7,00,001 - 10,00,000)
  if (totalincome > 700000 && income > 0) {
    const slab_income = Math.min(300000, income);
    tax += slab_income * 0.10;
    income -= slab_income;
    console.log(`10% tax on Rs. ${slab_income}, Total Tax Rs. ${tax}`);
  }

  // 15% slab (10,00,001 - 12,00,000)
  if (totalincome > 1000000 && income > 0) {
    const slab_income = Math.min(200000, income);
    tax += slab_income * 0.15;
    income -= slab_income;
    console.log(`15% tax on Rs. ${slab_income}, Total Tax Rs. ${tax}`);
  }

  // 20% slab (12,00,001 - 15,00,000)
  if (totalincome > 1200000 && income > 0) {
    const slab_income = Math.min(300000, income);
    tax += slab_income * 0.20;
    income -= slab_income;
    console.log(`20% tax on Rs. ${slab_income}, Total Tax Rs. ${tax}`);
  }

  // 30% slab (Above 15,00,000)
  if (totalincome > 1500000 && income > 0) {
    const slab_income = income; // Remaining income above 15,00,000
    tax += slab_income * 0.30;
    console.log(`30% tax on Rs. ${slab_income}, Total Tax Rs. ${tax}`);
  }

  // 10% surcharge
  if (totalincome > 5000000 && totalincome <= 10000000) {
    surcharge10 = tax * 0.10;
    tax += surcharge10;
    console.log(`10% surcharge on Rs. ${tax}, Total Tax Rs. ${tax}`);
  }

  // 15% surcharge
  if (totalincome > 10000000) {
    surcharge15 = tax * 0.15;
    tax += surcharge15;
    console.log(`15% surcharge on Rs. ${tax}, Total Tax Rs. ${tax}`);
  }

  const hes_tax = 4; // Health and Education Cess
  const hes = tax * (hes_tax / 100); // HES Health And Education Cess
  totalTax = hes + tax;

  return {
    tax,
    hes,
    surcharge10,
    surcharge15,
    totalTax
  };
}
