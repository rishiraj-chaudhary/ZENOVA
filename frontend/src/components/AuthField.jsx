const BASE_CLASS =
  "w-full p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-orange-400 outline-none";

/** Shared text input for the login and registration forms. */
const AuthField = ({ type = "text", placeholder, value, onChange, className }) => (
  <input
    type={type}
    placeholder={placeholder}
    aria-label={placeholder}
    value={value}
    onChange={onChange}
    className={className ?? BASE_CLASS}
    required
  />
);

export default AuthField;
