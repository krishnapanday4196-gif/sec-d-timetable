package com.btechcse.secd.timetable;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import java.util.Calendar;

public class ClassReminderReceiver extends BroadcastReceiver {
    public static final String ACTION_CLASS_REMINDER = "com.btechcse.secd.timetable.CLASS_REMINDER";
    public static final String CHANNEL_ID = "secd_class_app_notif_v5";
    public static final String PREFS_NAME = "secd_notif_prefs";

    // Period start times in minutes from midnight (L1..L8)
    // Reminders fire 5 minutes before each class start time
    public static final int[] PERIOD_START_MINS = {
        9 * 60,        // L1: 09:00 (Reminder at 08:55)
        9 * 60 + 55,   // L2: 09:55 (Reminder at 09:50)
        10 * 60 + 50,  // L3: 10:50 (Reminder at 10:45)
        11 * 60 + 45,  // L4: 11:45 Lunch
        12 * 60 + 40,  // L5: 12:40 (Reminder at 12:35)
        13 * 60 + 35,  // L6: 13:35 (Reminder at 13:30)
        14 * 60 + 30,  // L7: 14:30 (Reminder at 14:25)
        15 * 60 + 25   // L8: 15:25 (Reminder at 15:20)
    };

    public static final String[] PERIOD_IDS = {"L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"};
    public static final String[] PERIOD_TIMINGS = {
        "09:00 - 09:55",
        "09:55 - 10:50",
        "10:50 - 11:45",
        "11:45 - 12:40",
        "12:40 - 01:35",
        "01:35 - 02:30",
        "02:30 - 03:25",
        "03:25 - 04:20"
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            scheduleAllReminders(context);
            return;
        }

        if (ACTION_CLASS_REMINDER.equals(action)) {
            int periodIdx = intent.getIntExtra("period_idx", -1);
            if (periodIdx >= 0 && periodIdx < PERIOD_START_MINS.length) {
                handlePeriodReminder(context, periodIdx);
                // Reschedule for tomorrow / next occurrence
                scheduleSinglePeriodAlarm(context, periodIdx);
            }
        }
    }

    private void handlePeriodReminder(Context context, int periodIdx) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("alerts_enabled", true);
        if (!enabled) return;

        Calendar now = Calendar.getInstance();
        int calDay = now.get(Calendar.DAY_OF_WEEK);
        // Convert Calendar.DAY_OF_WEEK (Sun=1..Sat=7) to our 0..6 (Sun=0, Mon=1..Sat=6)
        int dayIdx = calDay - 1;
        if (dayIdx <= 0 || dayIdx > 6) return; // Sunday holiday

        String batch = prefs.getString("selected_batch", "Set-A");
        ClassInfo info = getClassInfo(dayIdx, periodIdx, batch);
        if (info == null || info.isSkip) return;

        String startTime = PERIOD_TIMINGS[periodIdx].split("-")[0].trim();
        String title = "⏰ Class 5 Minute Me Shuru Hone Wali Hai! (" + PERIOD_IDS[periodIdx] + " • " + startTime + ")";
        String shortBody = "📚 " + info.subject + " • 👨‍🏫 " + info.faculty + " (📍 " + info.room + ")";
        String bigText = "⏰ Aapki class 5 minute me shuru hone wali hai!\n"
                + "📚 Subject: " + info.subject + "\n"
                + "👨‍🏫 Faculty: " + info.faculty + "\n"
                + "📍 Room: " + info.room + " (" + info.batchLabel + ")\n"
                + "🕘 Timing: " + PERIOD_TIMINGS[periodIdx];

        showImmediateNotification(context, title, shortBody, bigText, 1000 + periodIdx);
    }

    public static class ClassInfo {
        public String subject;
        public String faculty;
        public String room;
        public String batchLabel;
        public boolean isSkip;

        public ClassInfo(String subject, String faculty, String room, String batchLabel, boolean isSkip) {
            this.subject = subject;
            this.faculty = faculty;
            this.room = room;
            this.batchLabel = batchLabel;
            this.isSkip = isSkip;
        }
    }

    public static String getOfficialFaculty(String subject) {
        if (subject == null) return "";
        if (subject.contains("Advance Programming in C")) return "Mr. Rahul Panda";
        if (subject.contains("Environmental Studies")) return "Mr. Akash Saini";
        if (subject.contains("Basics of Computer and C Programming")) return "Mrs. Ankita Singh Rana";
        if (subject.contains("Communication & Professional Skills")) return "Ms. Manvi Tyagi";
        if (subject.contains("Mini Project")) return "Mr. Rahul Panda";
        if (subject.contains("Computational & Quantum Physics")) return "Dr. Prosenjit Sarkar";
        if (subject.contains("Front-End Web Development")) return "Mrs. Shilpy Sharma";
        if (subject.contains("Computational Mathematics")) return "Dr. Monika";
        if (subject.contains("Fundamentals of Intelligent & Autonomous Systems")) return "Mr. Ankur Jain";
        if (subject.contains("Set-M1")) return "Mr. Shivam";
        if (subject.contains("Set-M2")) return "Mr. Vishal Parmar";
        if (subject.contains("Slow & Fast Learner")) return "Section-D Faculty";
        if (subject.contains("PROPS")) return "PROPS Activity Coordinator";
        return "Section-D Faculty";
    }

    public static ClassInfo getClassInfo(int dayIdx, int periodIdx, String batch) {
        if (periodIdx == 3) {
            return new ClassInfo("Lunch Break", "", "-", "ALL", true);
        }
        boolean isSetB = "Set-B".equalsIgnoreCase(batch);
        boolean isAll = "ALL".equalsIgnoreCase(batch);

        String subj = "";
        String room = "A-108";
        String batchLbl = isSetB ? "Set-B" : (isAll ? "Set-A & Set-B" : "Set-A");

        switch (dayIdx) {
            case 1: // MONDAY
                switch (periodIdx) {
                    case 0: subj = "Technical Training - Advance Programming in C"; room = "A-108"; break;
                    case 1: subj = "Environmental Studies-I"; room = "A-108"; break;
                    case 2: subj = "Basics of Computer and C Programming"; room = "A-108"; break;
                    case 4: subj = "Slow & Fast Learner Classes"; room = "A-108"; break;
                    case 5: subj = "Environmental Studies-I"; room = "A-108"; break;
                    case 6: subj = "Communication & Professional Skills -I"; room = "A-108"; break;
                    case 7: subj = "Mini Project-I"; room = "A-108"; break;
                }
                break;

            case 2: // TUESDAY
                switch (periodIdx) {
                    case 0: subj = "Computational & Quantum Physics"; room = "A-108"; break;
                    case 1:
                        if (isSetB) { subj = "Communication & Professional Skills -I"; room = "B-302"; batchLbl = "Set-B"; }
                        else if (isAll) { subj = "Set-A: Self Study | Set-B: Comm. Skills"; room = "B-302"; }
                        else { return new ClassInfo("Self Study", "", "-", "Set-A", true); }
                        break;
                    case 2: subj = "Basics of Computer and C Programming"; room = "A-108"; break;
                    case 4:
                    case 5:
                        if (isSetB) { subj = "Front-End Web Development Lab"; room = "B-303"; batchLbl = "Set-B"; }
                        else if (isAll) { subj = "A: C Prog Lab (E-303) | B: Web Dev Lab (B-303)"; room = "E-303 / B-303"; }
                        else { subj = "Basics of Computer and C Programming Lab"; room = "E-303"; batchLbl = "Set-A"; }
                        break;
                    case 6: subj = "Computational Mathematics for Intelligent Systems"; room = "A-108"; break;
                    case 7: subj = "Communication & Professional Skills -I"; room = "A-108"; break;
                }
                break;

            case 3: // WEDNESDAY
                switch (periodIdx) {
                    case 0:
                    case 1:
                        if (isSetB) { subj = "Computational & Quantum Physics Lab"; room = "Physics Lab (E-106)"; batchLbl = "Set-B"; }
                        else if (isAll) { subj = "A: Web Dev Lab (E-307) | B: Physics Lab (E-106)"; room = "E-307 / E-106"; }
                        else { subj = "Front-End Web Development Lab"; room = "E-307"; batchLbl = "Set-A"; }
                        break;
                    case 2: subj = "Basics of Computer and C Programming"; room = "A-108"; break;
                    case 4:
                    case 5:
                        if (isSetB) { subj = "Basics of Computer and C Programming Lab"; room = "E-303"; batchLbl = "Set-B"; }
                        else if (isAll) { subj = "Set-B: C Programming Lab (Set-A Self Study)"; room = "E-303"; }
                        else { return new ClassInfo("Self Study", "", "-", "Set-A", true); }
                        break;
                    case 6:
                    case 7: subj = "PROPS"; room = "Campus"; break;
                }
                break;

            case 4: // THURSDAY
                switch (periodIdx) {
                    case 0: subj = "Front-End Web Development"; room = "A-108"; break;
                    case 1:
                        if (isSetB) { return new ClassInfo("Self Study", "", "-", "Set-B", true); }
                        else { subj = "Communication & Professional Skills -I"; room = "B-302"; batchLbl = "Set-A"; }
                        break;
                    case 2: subj = "Fundamentals of Intelligent & Autonomous Systems"; room = "A-108"; break;
                    case 4: subj = "Computational Mathematics for Intelligent Systems"; room = "A-108"; break;
                    case 5: subj = "Computational & Quantum Physics"; room = "A-108"; break;
                    case 6: return new ClassInfo("Free Period", "", "-", "ALL", true);
                    case 7: subj = "Technical Training - Advance Programming in C"; room = "A-108"; break;
                }
                break;

            case 5: // FRIDAY
                switch (periodIdx) {
                    case 0:
                    case 1:
                        if (isSetB) { return new ClassInfo("Self Study", "", "-", "Set-B", true); }
                        else { subj = "Computational & Quantum Physics Lab"; room = "Physics Lab (E-106)"; batchLbl = "Set-A"; }
                        break;
                    case 2: subj = "Computational Mathematics for Intelligent Systems"; room = "A-108"; break;
                    case 4: subj = "Computational & Quantum Physics"; room = "A-109"; break;
                    case 5: subj = "Fundamentals of Intelligent & Autonomous Systems"; room = "A-302"; break;
                    case 6:
                        if (isSetB) { subj = "Mentor Mentee Meeting (Set-M2)"; room = "A-011"; batchLbl = "Set-B"; }
                        else if (isAll) { subj = "Mentor Mentee Meeting (M1: A-009 / M2: A-011)"; room = "A-009 / A-011"; }
                        else { subj = "Mentor Mentee Meeting (Set-M1)"; room = "A-009"; batchLbl = "Set-A"; }
                        break;
                    case 7: subj = "Front-End Web Development"; room = "A-108"; break;
                }
                break;

            case 6: // SATURDAY
                switch (periodIdx) {
                    case 0: subj = "Front-End Web Development"; room = "A-108"; break;
                    case 1: subj = "Computational & Quantum Physics"; room = "A-109"; break;
                    case 2: subj = "Computational Mathematics for Intelligent Systems"; room = "A-108"; break;
                    case 4: subj = "Fundamentals of Intelligent & Autonomous Systems"; room = "A-108"; break;
                    case 5: subj = "Technical Training - Advance Programming in C"; room = "A-108"; break;
                    case 6:
                    case 7: subj = "PROPS"; room = "Campus"; break;
                }
                break;
        }

        if (subj.isEmpty()) return null;
        String faculty = getOfficialFaculty(subj);
        return new ClassInfo(subj, faculty, room, batchLbl, false);
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Class Start Notifications (5 Min Before)",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Sends a phone notification 5 minutes before every Section-D lecture starts");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#38BDF8"));
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 250, 120, 250});
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                try {
                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    channel.setSound(soundUri, attrs);
                } catch (Exception ignored) {}
                nm.createNotificationChannel(channel);
            }
        }
    }

    public static void triggerSampleUpcomingNotification(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String batch = prefs.getString("selected_batch", "Set-A");
            Calendar now = Calendar.getInstance();
            int dayIdx = now.get(Calendar.DAY_OF_WEEK) - 1;
            if (dayIdx <= 0 || dayIdx > 6) dayIdx = 1; // Default to Monday if Sunday

            int curMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
            int targetIdx = 0;
            for (int i = 0; i < PERIOD_START_MINS.length; i++) {
                if (i == 3) continue;
                if (PERIOD_START_MINS[i] > curMins) {
                    targetIdx = i;
                    break;
                }
            }
            ClassInfo info = getClassInfo(dayIdx, targetIdx, batch);
            if (info == null || info.isSkip) {
                info = getClassInfo(1, 0, batch);
                targetIdx = 0;
            }
            String startTime = PERIOD_TIMINGS[targetIdx].split("-")[0].trim();
            String title = "⏰ Class 5 Minute Me Shuru Hone Wali Hai! (" + PERIOD_IDS[targetIdx] + " • " + startTime + ")";
            String shortBody = "📚 " + info.subject + " • 👨‍🏫 " + info.faculty + " (📍 " + info.room + ")";
            String bigText = "⏰ Aapki class 5 minute me shuru hone wali hai!\n"
                    + "📚 Subject: " + info.subject + "\n"
                    + "👨‍🏫 Faculty: " + info.faculty + "\n"
                    + "📍 Room: " + info.room + " (" + info.batchLabel + ")\n"
                    + "🕘 Timing: " + PERIOD_TIMINGS[targetIdx];

            showImmediateNotification(context, title, shortBody, bigText, 2026);
        } catch (Exception ignored) {}
    }

    @SuppressWarnings("deprecation")
    public static void showImmediateNotification(Context context, String title, String shortBody, String bigText, int notifId) {
        try {
            ensureNotificationChannel(context);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent contentIntent = PendingIntent.getActivity(context, notifId, openIntent, piFlags);

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(context, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(context);
                builder.setPriority(Notification.PRIORITY_HIGH);
                builder.setDefaults(Notification.DEFAULT_ALL);
            }

            builder.setSmallIcon(R.drawable.ic_stat_notify)
                    .setContentTitle(title)
                    .setContentText(shortBody)
                    .setSubText("Section-D Class Alert")
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis())
                    .setTicker(title)
                    .setStyle(new Notification.BigTextStyle()
                            .setBigContentTitle(title)
                            .setSummaryText("5 Min Pre-Class Notification")
                            .bigText(bigText != null && !bigText.isEmpty() ? bigText : shortBody))
                    .setAutoCancel(true)
                    .setContentIntent(contentIntent);

            try {
                Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher_round);
                if (largeIcon != null) {
                    builder.setLargeIcon(largeIcon);
                }
            } catch (Exception ignored) {}

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                builder.setCategory(Notification.CATEGORY_REMINDER);
                builder.setColor(0xFF0284C7);
                builder.setVisibility(Notification.VISIBILITY_PUBLIC);
            }

            nm.notify(notifId, builder.build());

            // Save notification in the Notification Library archive
            String notifType = (title != null && (title.contains("Update") || title.contains("Downloaded"))) ? "system" : "class_reminder";
            saveNotificationRecord(context, title, shortBody, bigText, notifType);
        } catch (Exception ignored) {}
    }

    public static final String PREFS_SAVED_NOTIFS = "saved_notifications_prefs";
    public static final String KEY_NOTIF_LIST = "saved_notifications_json";

    public static synchronized void saveNotificationRecord(Context context, String title, String shortBody, String bigText, String type) {
        if (context == null) return;
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS_SAVED_NOTIFS, Context.MODE_PRIVATE);
            String raw = sp.getString(KEY_NOTIF_LIST, "[]");
            org.json.JSONArray arr;
            try {
                arr = new org.json.JSONArray(raw);
            } catch (Exception e) {
                arr = new org.json.JSONArray();
            }

            org.json.JSONObject notif = new org.json.JSONObject();
            notif.put("id", "notif_" + System.currentTimeMillis() + "_" + ((int)(Math.random() * 900) + 100));
            notif.put("title", title != null ? title : "");
            notif.put("shortBody", shortBody != null ? shortBody : "");
            notif.put("bigText", bigText != null ? bigText : "");
            notif.put("type", type != null ? type : "class_reminder");
            notif.put("timestamp", System.currentTimeMillis());
            notif.put("read", false);

            org.json.JSONArray newArr = new org.json.JSONArray();
            newArr.put(notif);
            int limit = Math.min(arr.length(), 60);
            for (int i = 0; i < limit; i++) {
                newArr.put(arr.getJSONObject(i));
            }

            sp.edit().putString(KEY_NOTIF_LIST, newArr.toString()).apply();
        } catch (Exception ignored) {}
    }

    public static synchronized String getSavedNotificationsJson(Context context) {
        if (context == null) return "[]";
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS_SAVED_NOTIFS, Context.MODE_PRIVATE);
            return sp.getString(KEY_NOTIF_LIST, "[]");
        } catch (Exception e) {
            return "[]";
        }
    }

    public static synchronized boolean clearSavedNotifications(Context context) {
        if (context == null) return false;
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS_SAVED_NOTIFS, Context.MODE_PRIVATE);
            sp.edit().putString(KEY_NOTIF_LIST, "[]").apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static synchronized boolean markNotificationAsRead(Context context, String id) {
        if (context == null || id == null) return false;
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS_SAVED_NOTIFS, Context.MODE_PRIVATE);
            String raw = sp.getString(KEY_NOTIF_LIST, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.getJSONObject(i);
                if (id.equals(obj.optString("id", ""))) {
                    obj.put("read", true);
                }
            }
            sp.edit().putString(KEY_NOTIF_LIST, arr.toString()).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static void scheduleAllReminders(Context context) {
        for (int i = 0; i < PERIOD_START_MINS.length; i++) {
            if (i == 3) continue; // Skip Lunch L4
            scheduleSinglePeriodAlarm(context, i);
        }
    }

    public static void scheduleSinglePeriodAlarm(Context context, int periodIdx) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            // Reminder is 5 minutes before period start
            int reminderMins = PERIOD_START_MINS[periodIdx] - 5;
            int hour = reminderMins / 60;
            int minute = reminderMins % 60;

            Calendar now = Calendar.getInstance();
            Calendar target = Calendar.getInstance();
            target.set(Calendar.HOUR_OF_DAY, hour);
            target.set(Calendar.MINUTE, minute);
            target.set(Calendar.SECOND, 0);
            target.set(Calendar.MILLISECOND, 0);

            // If this time has already passed today, schedule for tomorrow
            if (target.getTimeInMillis() <= now.getTimeInMillis() + 2000) {
                target.add(Calendar.DAY_OF_YEAR, 1);
            }
            // If target falls on Sunday, advance to Monday
            if (target.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
                target.add(Calendar.DAY_OF_YEAR, 1);
            }

            Intent intent = new Intent(context, ClassReminderReceiver.class);
            intent.setAction(ACTION_CLASS_REMINDER);
            intent.putExtra("period_idx", periodIdx);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(context, 500 + periodIdx, intent, flags);

            Intent showAppIntent = new Intent(context, MainActivity.class);
            PendingIntent showPi = PendingIntent.getActivity(context, 600 + periodIdx, showAppIntent, flags);

            long triggerAt = target.getTimeInMillis();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAt, showPi), pi);
                    return;
                } catch (Exception ignored) {}
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (Exception ignored) {}
    }
}
