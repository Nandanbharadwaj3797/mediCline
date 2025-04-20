import { RiMicroscopeLine } from "react-icons/ri";
import ServicesCard from "../layouts/ServicesCard";
import { MdHealthAndSafety } from "react-icons/md";
import { FaHeartbeat } from "react-icons/fa";

const Services = () => {
  const icon1 = (
    <RiMicroscopeLine size={35} className=" text-backgroundColor" />
  );
  const icon2 = (
    <MdHealthAndSafety size={35} className=" text-backgroundColor" />
  );
  const icon3 = <FaHeartbeat size={35} className=" text-backgroundColor" />;

  return (
    <div className="flex flex-col px-5 pt-4 lg:px-32">
      <div className="flex flex-col items-center justify-between  lg:flex-row">
        <div>
          <h1 className="text-4xl font-semibold text-center  lg:text-start">
            Our Services
          </h1>
          <p className="mt-2 text-center  lg:text-start">
          At MediClean, we provide end-to-end solutions to ensure responsible and safe disposal of medical waste. Our services are designed to cater to clinics, hospitals, laboratories, and healthcare facilities with utmost precision and compliance.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-5  lg:flex-row pt-14">
        <ServicesCard icon={icon1} title="Hospital Or Clinics" />
        <ServicesCard icon={icon2} title="Collectors" />
        <ServicesCard icon={icon3} title="Recycling Industries" />
      </div>
    </div>
  );
};

export default Services;
