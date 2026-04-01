import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
    },
    email: {
      type: String, // Added capability for email OTP as well
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete document when expiration passes
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.methods.matchOtp = async function (enteredOtp) {
  return await bcrypt.compare(enteredOtp, this.otpHash);
};

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
