import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api/authAPI.js";
import AuthField from "../components/AuthField.jsx";

const FIELD_CLASS =
  "w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none";

const describeFailure = (error) =>
  error.details?.map((detail) => detail.message).join(", ") ?? error.message;

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register(form);
      navigate("/login");
    } catch (registerError) {
      setError(describeFailure(registerError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white w-96">
        <h2 className="text-3xl font-bold text-center text-blue-400 drop-shadow-lg">
          Register
        </h2>

        {error && (
          <p role="alert" className="mt-4 text-sm text-center text-red-400">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          <AuthField
            placeholder="Full Name"
            value={form.name}
            onChange={updateField("name")}
            className={FIELD_CLASS}
          />
          <AuthField
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={updateField("email")}
            className={FIELD_CLASS}
          />
          <AuthField
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={updateField("password")}
            className={FIELD_CLASS}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white py-3 rounded-md transition"
          >
            {submitting ? "Creating account…" : "Register"}
          </button>
        </form>

        <p className="text-center mt-4">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-blue-400 hover:underline"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;
