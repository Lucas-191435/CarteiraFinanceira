import "dotenv/config";

const authConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: "64h" as const,
  algorithm: "HS512" as const,
};

export default authConfig;