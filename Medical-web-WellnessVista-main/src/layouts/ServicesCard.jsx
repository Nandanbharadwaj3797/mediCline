import React from "react";
import { useNavigate } from "react-router-dom";

const ServicesCard = ({ icon, title }) => {
  const navigate = useNavigate();

  const getSignInPath = () => {
    switch(title) {
      case "Hospital Or Clinics":
        return "/signin";
      case "Collectors":
        return "/collector-signin";
      case "Recycling Industries":
        return "/recycler-signin";
      default:
        return "/";
    }
  };

  return (
    <div className="group flex flex-col items-center text-center gap-2 w-full lg:w-1/3 p-5 shadow-[rgba(0,_0,_0,_0.24)_0px_3px_8px] rounded-lg cursor-pointer lg:hover:-translate-y-6 transition duration-300 ease-in-out">
      <div>{icon}</div>
      <h1 className="font-semibold text-lg">{title}</h1>
      <button
        onClick={() => navigate(getSignInPath())}
        className="bg-backgroundColor text-white px-4 py-2 rounded-md hover:bg-[#2c8f7e] transition duration-300"
      >
        Sign In
      </button>
    </div>
  );
};

export default ServicesCard;
