tell application "Terminal"
    do script "\"" & POSIX path of (path to me) & "Contents/Resources/start_server.sh\""
    activate
end tell
