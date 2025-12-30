import { Asset } from '../types';

export const INITIAL_ASSETS: Asset[] = [
  {
    id: '1',
    name: 'Finca La Dehesa',
    divisible: true,
    subItems: [
      { id: '1-1', concept: 'Barbecho', quantity: 2000, unit: 'm2', unitValue: 5 },
      { id: '1-2', concept: 'Cultivo Almendro', quantity: 5000, unit: 'm2', unitValue: 12 },
      { id: '1-3', concept: 'Casa de campo', quantity: 200, unit: 'm2', unitValue: 400 },
    ],
  },
  {
    id: '2',
    name: 'Gran Explotación Agrícola',
    divisible: true,
    subItems: [
      { id: '2-1', concept: 'Cultivo Almendro', quantity: 400000, unit: 'm2', unitValue: 12 },
      { id: '2-2', concept: 'Barbecho', quantity: 100000, unit: 'm2', unitValue: 5 },
    ],
  },
  {
    id: '3',
    name: 'Casa en el Pueblo',
    divisible: false,
    subItems: [
      { id: '3-1', concept: 'Superficie construida', quantity: 150, unit: 'm2', unitValue: 800 },
    ],
  },
  {
    id: '4',
    name: 'Local Comercial',
    divisible: false,
    subItems: [
      { id: '4-1', concept: 'Superficie', quantity: 80, unit: 'm2', unitValue: 1200 },
    ],
  },
  {
    id: '5',
    name: 'Cuenta Bancaria',
    divisible: true,
    subItems: [
      { id: '5-1', concept: 'Saldo actual', quantity: 1, unit: 'total', unitValue: 150000 },
    ],
  },
];
