export interface JwtPayload {
  sub: string;
  role: string;
  type: 'administrator' | 'patient';
}

export interface RefreshJwtPayload extends JwtPayload {
  jti: string;
}
