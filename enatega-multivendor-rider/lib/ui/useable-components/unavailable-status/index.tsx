import { useUserContext } from "@/lib/context/global/user.context";
import { usePathname } from "expo-router";
import { isBoolean } from "lodash";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UnavailableStatus() {
  // Hooks - must be called before any conditional returns
  const pathName = usePathname();
  const { dataProfile } = useUserContext();
  const insets = useSafeAreaInsets(); // Get Safe Area Insets

  // Check conditions after all hooks are called
  const shouldShow =
    pathName !== "/login" &&
    isBoolean(dataProfile?.available) &&
    !dataProfile?.available;

  // Use conditional rendering instead of early return
  if (!shouldShow) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        paddingTop: insets.top - 9, // Ensures it stays below the notch
        paddingHorizontal: 16,
        paddingBottom: 2,
        position: "absolute",
        width: "100%",
        zIndex: 50,
      }}
    >
      <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
        You are currently unavailable.
      </Text>
    </View>
  );
}
