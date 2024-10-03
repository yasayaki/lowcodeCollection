import express, { Application, Request, Response } from "express";

const app: Application = express();
const PORT = 3000;

// app.get('/', (req: Request, res: Response) => {
//   console.log("getリクエストを受け付けました。");
//   return res.status(200).json({ message: "hello world" });
// })


try {
  app.listen(PORT, () => {
    console.log(`server running at://localhost:${PORT}`);
  });
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message);
  }
}