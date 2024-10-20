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

    // 10% slab
    if (income >= 500000) {
      tax += 250000 * (10 / 100);
      income = totalincome - 750000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (10 / 100);
      break;
    }

    // 15% slab
    if (income >= 750000) {
      tax += 250000 * (15 / 100);
      income = totalincome - 1000000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (15 / 100);
      break;
    }

    // 20% slab
    if (income >= 1000000) {
      tax += 250000 * (20 / 100);
      income = totalincome - 1250000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (20 / 100);
      break;
    }

    // 25% slab
    if (income >= 1250000) {
      tax += 250000 * (25 / 100);
      income = totalincome - 1500000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (25 / 100);
      break;
    }

    // 30% slab
    if (totalincome >= 1500000) {
      income = totalincome - 1500000;
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

export function calculateTax2024_25(totalincome: number) {
  let income = totalincome;
  let tax = 0;
  let surcharge10 = 0;
  let surcharge15 = 0;
  let totalTax = 0;

  // If total income is less than 300000, no tax to be paid
  while (income > 300000) {
    // No tax on 300000 slab
    income = totalincome - 300000;

    // 5% slab
    if (income >= 300000) {
      tax += 400000 * (5 / 100);
      income = totalincome - 700000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (5 / 100); // Apply 5% tax on remaining income
      break;
    }

    // 10% slab
    if (income >= 700000) {
      tax += 300000 * (10 / 100);
      income = totalincome - 1000000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (10 / 100);
      break;
    }

    // 15% slab
    if (income >= 1000000) {
      tax += 200000 * (15 / 100);
      income = totalincome - 1200000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (15 / 100);
      break;
    }

    // 20% slab
    if (income >= 1200000) {
      tax += 300000 * (20 / 100);
      income = totalincome - 1500000; // Adjust income for next slab
    } else if (income > 0) {
      tax += income * (20 / 100);
      break;
    }

    // 30% slab for income above ₹15,00,000
    if (totalincome >= 1500000) {
      income = totalincome - 1500000;
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
