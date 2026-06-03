import express from "express";
import cookieParser from "cookie-parser";

import adminRoutes from "./admin/admin.routes";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(cookieParser());
app.use(express.json());

app.get("/" , (req , res)=>{
    console.log("runnig /")
    res.json({
        msg:"running",
        success: true
    })
})
app.use("/admin", adminRoutes)
app.use("/auth", authRoutes)
app.listen(5000, () => {
  console.log("Server running on 5000");
});
export default app;