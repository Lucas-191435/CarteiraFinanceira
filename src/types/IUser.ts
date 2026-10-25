// Espelha UserResponseDto da API (GET /user/me, POST /user)
export interface IUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Espelha SearchUserResponseDto da API (GET /user/search)
export interface IRecipient {
  name: string;
  email: string;
}

// Espelha LoginResponseDto da API (POST /auth/login)
export interface ILoginResponse {
  user: Pick<IUser, "id" | "email" | "name">;
  token: string;
}
