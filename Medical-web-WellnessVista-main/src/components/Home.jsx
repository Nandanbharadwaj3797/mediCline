import React from "react";
import Button from "../layouts/Button";

const Home = () => {
  return (
    <div className=" min-h-screen flex flex-col justify-center lg:px-32 px-5 text-white bg-[url('assets/img/img2.png')] bg-no-repeat bg-cover opacity-90">
      <div className=" w-full lg:w-4/5 space-y-5 mt-10">
        <h1 className="text-5xl font-bold leading-tight">
          Your Portal to Responsible Medical Waste Management...
        </h1>
        <p>
          Mediclean is a smart, streamlined platform designed to simplify the way clinics, collectors, and health departments manage biomedical waste. From effortless waste logging and pickup scheduling to real-time tracking and compliance reporting, Mediclean empowers every stakeholder with tools for safer, more sustainable healthcare operations. Join us in protecting communities and the environment—one clean action at a time.
        </p>

      </div>
    </div>
  );
};

export default Home;
