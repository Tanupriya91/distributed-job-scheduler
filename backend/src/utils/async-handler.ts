import { NextFunction, Request, Response } from "express";

type AsyncHandler<Args extends unknown[]> = (
  req: Request,
  res: Response,
  next: NextFunction,
  ...rest: Args
) => Promise<unknown>;

export function asyncHandler<Args extends unknown[] = []>(fn: AsyncHandler<Args>) {
  return (req: Request, res: Response, next: NextFunction, ...rest: Args) => {
    fn(req, res, next, ...rest).catch(next);
  };
}
