import React from "react";
import img from "../assets/img/img4.jpg";

const About = () => {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-center lg:px-32 px-5 pt-16 lg:pt-8 pb-8 gap-5">
      <div className=" w-full lg:w-3/4 space-y-4">
        <h1 className=" text-4xl font-semibold text-center lg:text-start">About Us</h1>
        <p className=" text-justify lg:text-start">
        At Mediclean, we believe that responsible healthcare doesn't end with treatment — it extends to how we manage the waste it generates. With India producing over 600 tons of biomedical waste daily, the need for smart, scalable, and compliant waste solutions has never been more urgent.
        </p>
        <p className="text-justify lg:text-start">
        Mediclean is a dedicated web portal that bridges the gap between clinics, collection agencies, and health departments, offering an all-in-one solution for waste logging, pickup scheduling, real-time route optimization, and regulatory compliance. Our platform is designed to be mobile-friendly, easy to use, and data-driven — ensuring transparency, accountability, and sustainability at every step.
        </p>
        <p className="text-justify lg:text-start">
        We are driven by impact, powered by simplicity, and guided by purpose.
        Whether you're a rural clinic or a metro hospital, Mediclean adapts to your workflow.
        Let's turn medical waste from a problem into a process — smart, safe, and sustainable.
        </p>
      </div>
      <div className=" w-full lg:w-3/4">
        <img className="min-h-[55vh] rounded-lg" src={img} alt="img" />
      </div>
    </div>
  );
};

export default About;
