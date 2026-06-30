import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const SettingSchema = new mongoose.Schema(
    {
        replay_speed: Number,
        replay_autoplay: Boolean,
        replay_mode: Boolean,
        excluded_ips: [String],
        excluded_countries: [String],
        collect_email: Boolean,
        require_consent: Boolean,
        show_cookies_bar: Boolean,
        cookies_bar_content: {
            message: String,
            privacyPolicyUrl: String,
            okButtonText: String,
            infoLinkText: String,
        },
        weekly_email_report: {
            status: Boolean,
            hour_of_day: String,
            day_of_week: String,
            location_time_zone: String,
            is_custom_email: Boolean,
            custom_email: String,
        },
        analytic_sync: {
            status: Boolean,
            sync_type: String,
            is_receive_email: Boolean,
        },
        notify_new_visitor: Boolean,
        delay_capture: Boolean,
        mask_checkout: Boolean,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { timestamps: true, versionKey: false },
);

export const SettingModels = {
    1: Db.ApiV1.model('Setting', SettingSchema),
    2: Db.ApiV2.model('Setting', SettingSchema),
};
