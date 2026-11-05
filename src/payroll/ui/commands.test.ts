import { describe, expect, it } from 'vitest';
import { parseIntent } from './commands';

const employees = [{ id: 'a', name: 'Dr. Asha Verma' }, { id: 'b', name: 'Shri Ravi Kumar' }];

describe('typed requests', () => {
  it('lists or prints everyone', () => {
    expect(parseIntent('Show all employees', employees)).toEqual({ kind: 'everyone' });
    expect(parseIntent('summary', employees)).toEqual({ kind: 'everyone' });
    expect(parseIntent('Print all tax computations', employees)).toEqual({ kind: 'everyone', print: 'tax' });
    expect(parseIntent('print slips for all employees', employees)).toEqual({ kind: 'everyone', print: 'slips' });
  });

  it('still picks one employee by name', () => {
    expect(parseIntent('tax for Verma', employees)).toMatchObject({ kind: 'tax', employeeId: 'a' });
    expect(parseIntent('slip for March Kumar', employees)).toMatchObject({ kind: 'slip', employeeId: 'b', month: 3 });
    expect(parseIntent('Download everything as Excel', employees)).toMatchObject({ kind: 'export' });
    expect(parseIntent('download all employees', employees)).toMatchObject({ kind: 'export' });
  });
});
