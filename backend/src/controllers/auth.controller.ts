import { Request, Response } from "express";
import { getCurrentUser, loginUser, registerUser } from "../services/auth.service";

export async function register(req: Request, res: Response) {
  const result = await registerUser(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await loginUser(req.body);
  res.status(200).json(result);
}

export async function me(req: Request, res: Response) {
  const result = await getCurrentUser(req.user!.id);
  res.status(200).json(result);
}
