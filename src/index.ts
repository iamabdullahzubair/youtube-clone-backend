import app from "./app";
import dotenv from "dotenv"
import connectDB from "./config/db";

dotenv.config({path: "./.env"})
const PORT = process.env.PORT || 5000;

connectDB()
.then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port --> ${PORT}`);
    });
    
})
.catch((err:any) => {
    console.log("MONGO DB connection failed!!", err)
})

