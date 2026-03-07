export default function siteData() {
  const site = {
    restaurantName: "ETHNL",
    menuHeading: "ETHNL Menu",
    currency: "USD",
    timeZone: "America/Chicago",
    hours: [
      { day: "Sunday", open: "11:00 AM", close: "9:00 PM" },
      { day: "Monday", open: "5:00 PM", close: "9:00 PM" },
      { day: "Tuesday", open: "5:00 PM", close: "9:00 PM" },
      { day: "Wednesday", open: "5:00 PM", close: "9:00 PM" },
      { day: "Thursday", open: "5:00 PM", close: "9:00 PM" },
      { day: "Friday", open: "5:00 PM", close: "12:00 AM" },
      { day: "Saturday", open: "11:00 AM", close: "12:00 AM" }
    ]
  };

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: site.timeZone
  }).format(new Date());

  site.todayHours = site.hours.find((entry) => entry.day === today) || null;
  return site;
}
