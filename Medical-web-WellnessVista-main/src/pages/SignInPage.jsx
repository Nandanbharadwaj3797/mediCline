import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const SignInPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [requestData, setRequestData] = useState({
    hospitalName: "",
    address: "",
    contactNo: "",
    pinCode: "",
    garbageAmount: "",
  });
  const [activeTab, setActiveTab] = useState("signin");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRequestChange = (e) => {
    const { name, value } = e.target;
    setRequestData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle login logic here
    console.log("Login attempted with:", formData);
  };

  const handleRequestSubmit = (e) => {
    e.preventDefault();
    // Handle request submission here
    console.log("Request submitted with:", requestData);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <div className="bg-backgroundColor text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-semibold">MediClean</span>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("signin")}
                className={`px-4 py-2 rounded-md ${
                  activeTab === "signin"
                    ? "bg-white text-backgroundColor"
                    : "text-white hover:bg-[#2c8f7e]"
                } transition duration-300`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab("generate")}
                className={`px-4 py-2 rounded-md ${
                  activeTab === "generate"
                    ? "bg-white text-backgroundColor"
                    : "text-white hover:bg-[#2c8f7e]"
                } transition duration-300`}
              >
                Generate Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-backgroundColor">
              {activeTab === "signin" ? "Sign In to MediClean" : "Generate Waste Collection Request"}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Hospital and Clinics Portal
            </p>
          </div>
          
          {activeTab === "signin" ? (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email/Username
                  </label>
                  <input
                    type="text"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-backgroundColor focus:ring-backgroundColor border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-backgroundColor hover:text-[#2c8f7e]">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-backgroundColor hover:bg-[#2c8f7e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-backgroundColor transition duration-300"
                >
                  Sign In
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleRequestSubmit}>
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700 mb-1">
                    Hospital/Clinic Name
                  </label>
                  <input
                    type="text"
                    id="hospitalName"
                    name="hospitalName"
                    value={requestData.hospitalName}
                    onChange={handleRequestChange}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={requestData.address}
                    onChange={handleRequestChange}
                    rows="3"
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contactNo" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    id="contactNo"
                    name="contactNo"
                    value={requestData.contactNo}
                    onChange={handleRequestChange}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="pinCode" className="block text-sm font-medium text-gray-700 mb-1">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    id="pinCode"
                    name="pinCode"
                    value={requestData.pinCode}
                    onChange={handleRequestChange}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="garbageAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Garbage Amount (in Kg)
                  </label>
                  <input
                    type="number"
                    id="garbageAmount"
                    name="garbageAmount"
                    value={requestData.garbageAmount}
                    onChange={handleRequestChange}
                    min="0"
                    step="0.1"
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-backgroundColor focus:border-backgroundColor focus:z-10 sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-backgroundColor hover:bg-[#2c8f7e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-backgroundColor transition duration-300"
                >
                  Submit Request
                </button>
              </div>
            </form>
          )}

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                onClick={() => navigate('/register')}
                className="font-medium text-backgroundColor hover:text-[#2c8f7e]"
              >
                Register here
              </button>
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-backgroundColor hover:text-[#2c8f7e]"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage; 