export interface AuthenticatedUser {
  id: string;
  role: string;
  type: 'administrator' | 'patient';
}
