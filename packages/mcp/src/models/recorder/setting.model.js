import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const RecorderSettingSchema = new mongoose.Schema(
    {
        replay_speed: Number,
        replay_autoplay: Boolean,
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
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { timestamps: true, versionKey: false },
);

export const RecorderSettingModels = {
    1: Db.RecorderV1.model('Setting', RecorderSettingSchema),
    2: Db.RecorderV2.model('Setting', RecorderSettingSchema),
};
