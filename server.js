/* server.js ― tiny Express API */
import express  from "express";
import cors     from "cors";
import chatRoute from "./routes/chat.js";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());               //  <-- accepts JSON
app.use(express.urlencoded({ extended: true })); //  <-- accepts form-URL-encoded

app.use("/api", chatRoute);            //  /api/chat

app.get("/", (_req, res) => res.status(200).send("Johnny-Chat is up"));

app.listen(PORT, () => {
  console.log(`✅  API listening on :${PORT}`);
});
