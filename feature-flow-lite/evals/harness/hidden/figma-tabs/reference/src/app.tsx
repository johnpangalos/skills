import { Tab, TabList, TabPanel, Tabs } from "./tabs";

// The page the Figma test opens: one Tabs with a disabled tab.
export function App() {
  return (
    <main className="bg-white p-8">
      <Tabs defaultValue="overview">
        <TabList aria-label="Project">
          <Tab value="overview">Overview</Tab>
          <Tab value="activity">Activity</Tab>
          <Tab value="settings" disabled>
            Settings
          </Tab>
        </TabList>
        <TabPanel value="overview">Overview panel</TabPanel>
        <TabPanel value="activity">Activity panel</TabPanel>
        <TabPanel value="settings">Settings panel</TabPanel>
      </Tabs>
    </main>
  );
}
