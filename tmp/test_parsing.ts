
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NA";
}

function testParsing(rawPosition: string, title: string) {
    let teamPrefix = "";
    let roleName = rawPosition;

    if (rawPosition.includes("|")) {
      const parts = rawPosition.split("|");
      teamPrefix = parts[0]?.trim() || "";
      roleName = parts[1]?.trim() || rawPosition;
    }

    const roleLower = roleName.toLowerCase();
    
    let groupName = "Members";
    let normalizedRole = roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();

    if (roleLower === "tl") {
      groupName = "TLs";
      normalizedRole = "TL";
    } else if (roleLower === "member") {
      groupName = "Members";
      normalizedRole = "Member";
    } else {
      groupName = normalizedRole;
    }

    if (title === "MST" && teamPrefix) {
      groupName = teamPrefix;
    }

    console.log(`Input: "${rawPosition}" (Dashboard: ${title})`);
    console.log(` - Team Prefix: "${teamPrefix}"`);
    console.log(` - Role Name: "${roleName}"`);
    console.log(` - Normalized Role: "${normalizedRole}"`);
    console.log(` - Group Name: "${groupName}"`);
    console.log('---');
}

console.log("MST Dashboard Tests:");
testParsing("T01 | member", "MST");
testParsing("T02 | TL", "MST");
testParsing("T03 | Manager", "MST");
testParsing("member", "MST");

console.log("\nMKT Dashboard Tests:");
testParsing("T01 | member", "MKT");
testParsing("TL", "MKT");
testParsing("member", "MKT");
