import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Sales from './Sales';
import api from '../api';

const { t } = vi.hoisted(() => ({ t: value => value }));

vi.mock('../api', () => ({ default: { get: vi.fn() } }));
vi.mock('../i18n', () => ({ useLanguage: () => ({ t }) }));

const sale = {
  id: 'sale-100',
  saleNumber: 'S-100',
  saleDate: '2026-11-15T09:30:00Z',
  customer: { name: 'B Kishor' },
  paymentMethod: 'CASH',
  totalAmount: 100,
  items: [{
    id: 'item-100', product: { name: 'Silk Saree' }, quantity: 1, unitPrice: 100, subtotal: 100
  }]
};

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  api.get.mockImplementation(path => {
    if (path === '/sales/sale-100') return Promise.resolve({ data: sale });
    return Promise.resolve({ data: { content: [], totalElements: 0 } });
  });
});

describe('Sales', () => {
  it('loads the matching sale details from a sale-detail route', async () => {
    render(<MemoryRouter initialEntries={['/sales/sale-100']}><Routes>
      <Route path="/sales/:saleId" element={<Sales />} />
    </Routes></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Sale S-100' })).toBeTruthy();
    expect(screen.getByText('Silk Saree')).toBeTruthy();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/sales/sale-100'));
  });
});
