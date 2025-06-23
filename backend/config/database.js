import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/therapy';
    await mongoose.connect(mongoURI);
    console.log("MongoDB Connected");
    
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

export default connectDB;