import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const context = { module: { exports: {} } };
runInNewContext(readFileSync(new URL('../../../public/workflow/queue.js', import.meta.url), 'utf8'), context);
const queue = context.module.exports;
const lead = (extra = {}) => ({ name: 'Sample', email: 'person@example.com', received_at: '2026-09-25', status: 'new', last_contact: '', owner: 'Sam', ...extra });
const priority = (extra) => queue.build([lead(extra)], '2026-10-01').queue[0];

describe('follow-up rules and data integrity', () => {
  it('distinguishes overdue, today, and upcoming using calendar dates', () => {
    expect(priority({}).priority).toBe('Overdue');
    expect(priority({ received_at: '2026-10-01' }).priority).toBe('Today');
    expect(priority({ status: 'contacted', last_contact: '2026-09-30' }).priority).toBe('Upcoming');
    expect(priority({ status: 'quoted', last_contact: '2026-09-29' }).due_at).toBe('2026-10-01');
  });
  it('excludes won/lost inquiries without removing them from the source', () => {
    const source = [lead({ status: 'won' }), lead({ status: ' LOST ' })];
    const before = JSON.stringify(source);
    expect(queue.build(source, '2026-10-01').closed).toBe(2);
    expect(queue.build(source, '2026-10-01').queue).toHaveLength(0);
    expect(JSON.stringify(source)).toBe(before);
  });
  it.each([
    { received_at: '2026-02-30' }, { received_at: '2026-10-02' },
    { status: 'unknown' }, { owner: '' }, { email: 'broken' }, { name: '' },
    { status: 'contacted', last_contact: '' }, { last_contact: '2026-09-24' },
    { last_contact: '2026-10-02' }, { last_contact: '2026-02-30' },
  ])('flags a record requiring human review: %j', (input) => {
    expect(priority(input).priority).toBe('Review');
  });
  it('flags repeated emails case-insensitively without merging distinct inquiries', () => {
    const result = queue.build([lead({ email: 'PERSON@example.com' }), lead({})], '2026-10-01');
    expect(result.queue).toHaveLength(2);
    expect(result.queue.every((r) => r.action.includes('Repeated email'))).toBe(true);
    expect(result.queue.map((r) => r.source_row)).toEqual([2, 3]);
  });
  it('orders review items before due work and retains original row references', () => {
    const result = queue.build([lead({ email: 'first@example.com' }), lead({ email: 'second@example.com', owner: '' })], '2026-10-01');
    expect(result.queue.map((r) => r.source_row)).toEqual([3, 2]);
  });
  it('rejects invalid review dates including leap-day rollover', () => {
    expect(() => queue.build([], '2026-02-29')).toThrow();
    expect(() => queue.build([], '2028-02-29')).not.toThrow();
  });
});

describe('CSV input and export', () => {
  const header = 'name,email,received_at,status,last_contact,owner';
  it('handles a BOM, CRLF, commas, escaped quotes, and multiline fields', () => {
    const input = '\uFEFF' + header + '\r\n"Jo, ""J""\nSmith",jo@example.com,2026-10-01,new,,Sam\r\n';
    expect(queue.parseCsv(input)[0].name).toBe('Jo, "J"\nSmith');
  });
  it('keeps spreadsheet row references correct when blank rows occur', () => {
    const records = queue.parseCsv(header + '\n\nA,a@example.com,2026-10-01,new,,Sam\n,,,,,\nB,b@example.com,2026-10-01,new,,Sam');
    expect(queue.build(records, '2026-10-01').queue.map((r) => r.source_row)).toEqual([3, 5]);
  });
  it.each([
    header + '\n"unclosed', header + '\n"closed"junk,a,b,c,d,e',
    header + '\nwrong,columns', 'name,email', header + ',name',
  ])('rejects malformed CSV instead of silently dropping data', (input) => {
    expect(() => queue.parseCsv(input)).toThrow();
  });
  it('allows a header-only empty queue and rejects more than 1,000 inquiries', () => {
    expect(queue.parseCsv(header)).toHaveLength(0);
    const row = 'A,a@example.com,2026-10-01,new,,Sam';
    expect(queue.parseCsv(header + '\n' + Array(1000).fill(row).join('\n'))).toHaveLength(1000);
    expect(() => queue.parseCsv(header + '\n' + Array(1001).fill(row).join('\n'))).toThrow();
  });
  it.each(['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1'])('neutralizes formula-like text in exported spreadsheet cells', (value) => {
    expect(queue.safeCell(value).startsWith("'")).toBe(true);
    expect(queue.toCsv([{ name: value }])).toContain('"\'' + value + '"');
  });
});
