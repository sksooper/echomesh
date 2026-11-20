/** Role w systemie. Dziedziczenie uprawnień: admin ⊃ analyst ⊃ resident (patrz auth/roles.ts). */
export type Role = 'resident' | 'analyst' | 'admin';

/** Użytkownik bez hasła — to jest wersja, którą wolno zwracać przez API. */
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

/** Wiersz z bazy łącznie ze skrótem hasła (tylko do użytku wewnątrz backendu). */
export interface UserWithHash extends User {
  passwordHash: string;
}
