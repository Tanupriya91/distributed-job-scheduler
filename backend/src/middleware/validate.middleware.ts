import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

export function validateBody(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function validateQuery(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as unknown as Request["query"];
      next();
    } catch (err) {
      next(err);
    }
  };
}
